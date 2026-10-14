"""Generates docs/architecture.drawio: the microservice architecture with hand-routed orthogonal connectors.

Usage: python docs/generate_architecture.py docs/architecture.drawio [rabbitmq-logo-source.drawio]
The RabbitMQ logo is copied from the logo source file; it defaults to the existing output file.

Layout:
  - One row of services. Above them, the API Gateway's HTTP trunk with a drop into each service,
    plus one small box per external service, directly above the service that uses it.
  - Below the services, one RabbitMQ exchange per publisher. Each exchange has its own coloured
    bus that fans out to its consumers; junction dots mark where a line branches.
"""
import os
import re
import sys
from xml.sax.saxutils import escape as _esc

OUT = sys.argv[1]
LOGO_SRC = sys.argv[2] if len(sys.argv) > 2 else (OUT if os.path.exists(OUT) else None)


def esc(s):
    return _esc(s, {'"': "&quot;"})


# ------------------------------------------------------------------ geometry constants
X0, PITCH, SW, SH = 300, 270, 190, 90       # services: first x, column pitch, width, height
SY = 470                                    # services top y
TRUNK_Y = 230                               # gateway HTTP trunk
CAT_Y = 420                                 # service -> Catalog calls that go over a neighbour
EXT_Y, EXT_H = 290, 60                      # external boxes
TRACK_Y0, TRACK_SP = 615, 26                # event bus tracks
EX_Y = 790                                  # exchange boxes top
GW_PORT, A_X, A_W, B_X, B_W = 25, 45, 70, 118, 70   # top-port / external-box offsets inside a column

COLS = ["search", "authorization", "users", "editorial", "messaging", "catalog",
        "auctions", "orders", "payment", "notif"]
SERVICES = {
    "search": ("Search", ["MongoDB", "Redis"]),
    "authorization": ("Authorization", []),
    "users": ("Users", ["PostgreSQL"]),
    "editorial": ("Editorial", ["MongoDB"]),
    "messaging": ("Messaging", ["MongoDB"]),
    "catalog": ("Catalog", ["PostgreSQL"]),
    "auctions": ("Auctions", ["DB"]),
    "orders": ("Orders", ["PostgreSQL"]),
    "payment": ("Payment", ["DB"]),
    "notif": ("Notif / Email", ["DB"]),
}

SUPA = ("#e3f6ec", "#3ecf8e")
SAAS = ("#f5f5f5", "#666666")
# external key -> (label, colours, column, slot "A" | "B" | "AB")
EXTERNALS = {
    "supa_auth": ("Supabase Auth", SUPA, "authorization", "AB"),
    "supa_hook": ("Supabase DB webhook", SUPA, "users", "A"),
    "supa_store_users": ("Supabase Storage<br><i>avatars</i>", SUPA, "users", "B"),
    "supa_store_editorial": ("Supabase Storage<br><i>blog media</i>", SUPA, "editorial", "AB"),
    "supa_realtime": ("Supabase Realtime", SUPA, "messaging", "AB"),
    "supa_store_catalog": ("Supabase Storage<br><i>product images</i>", SUPA, "catalog", "A"),
    "ai": ("Cloud AI provider", SAAS, "catalog", "B"),
    "ipapi": ("ipapi.co<br><i>geo-IP</i>", SAAS, "orders", "AB"),
    "stripe": ("Stripe", SAAS, "payment", "AB"),
    "resend": ("Resend<br><i>email</i>", SAAS, "notif", "AB"),
}

EXCHANGES = {  # name -> (publisher, colour, [(event, [consumers])])
    "user.events": ("users", "#1f6fd1", [
        ("user_created", ["notif"]),
        ("user_deleted", ["notif", "orders", "messaging", "editorial", "auctions"]),
        ("notification_setting_changed", ["notif"]),
        ("email_updated", ["notif"])]),
    "catalog.events": ("catalog", "#2e9e3f", [
        ("product_created", ["search", "notif"]),
        ("product_updated", ["search", "notif"]),
        ("product_deleted", ["search", "notif", "users"])]),
    "auction.events": ("auctions", "#0e8088", [
        ("auction_complete", ["orders", "catalog", "notif"])]),
    "order.events": ("orders", "#e07b00", [
        ("order_placed", ["payment", "catalog", "notif"]),
        ("order_cancelled", ["payment", "catalog", "notif"]),
        ("order_expired", ["catalog", "notif"])]),
    "payment.events": ("payment", "#8e44ad", [
        ("payment_complete", ["orders", "catalog", "notif"]),
        ("payment_failed", ["orders", "notif"])]),
}
NAME = {k: v[0] for k, v in SERVICES.items()}


def col_x(svc):
    return X0 + PITCH * COLS.index(svc)


def ext_box(key):
    _, _, svc, slot = EXTERNALS[key]
    x = col_x(svc)
    if slot == "A":
        return x + A_X, EXT_Y, A_W, EXT_H
    if slot == "B":
        return x + B_X, EXT_Y, B_W, EXT_H
    return x + A_X, EXT_Y, B_X + B_W - A_X, EXT_H


# ------------------------------------------------------------------ draw.io writer
class W:
    def __init__(self):
        self.cells, self.n, self.ids, self.boxes = [], 0, {}, {}

    def nid(self):
        self.n += 1
        return f"a{self.n}"

    def vertex(self, key, value, style, x, y, w, h, parent="1"):
        i = self.nid()
        self.cells.append(f'<mxCell id="{i}" value="{esc(value)}" style="{style}" vertex="1" parent="{parent}">'
                          f'<mxGeometry x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" as="geometry"/></mxCell>')
        if key:
            self.ids[key] = i
            if parent == "1":
                self.boxes[key] = (x, y, w, h)
        return i

    def edge(self, src, dst, pts, color="#222222", start="none", end="blockThin", label=None, width=1.5,
             label_pos=0.0, dashed=False):
        """pts: full polyline incl. both terminal points (absolute)."""
        def constraint(key, p, prefix):
            x, y, w, h = self.boxes[key]
            return (f"{prefix}X={(p[0] - x) / w:.4f};{prefix}Y={(p[1] - y) / h:.4f};"
                    f"{prefix}Dx=0;{prefix}Dy=0;{prefix}Perimeter=0;")
        style = (f"edgeStyle=none;rounded=0;html=1;strokeColor={color};strokeWidth={width};endArrow={end};"
                 f"startArrow={start};endFill=1;startFill=1;endSize=7;startSize=7;fontSize=10;"
                 f"labelBackgroundColor=#ffffff;{'dashed=1;' if dashed else ''}")
        attrs = ""
        if src:
            style += constraint(src, pts[0], "exit")
            attrs += f' source="{self.ids[src]}"'
        if dst:
            style += constraint(dst, pts[-1], "entry")
            attrs += f' target="{self.ids[dst]}"'
        mids = "".join(f'<mxPoint x="{x:.1f}" y="{y:.1f}"/>' for x, y in pts[1:-1])
        terms = (f'<mxPoint x="{pts[0][0]:.1f}" y="{pts[0][1]:.1f}" as="sourcePoint"/>'
                 f'<mxPoint x="{pts[-1][0]:.1f}" y="{pts[-1][1]:.1f}" as="targetPoint"/>')
        eid = self.nid()
        self.cells.append(f'<mxCell id="{eid}" style="{style}" edge="1" parent="1"{attrs}>'
                          f'<mxGeometry relative="1" as="geometry">{terms}<Array as="points">{mids}</Array>'
                          f'</mxGeometry></mxCell>')
        if label:
            self.cells.append(f'<mxCell id="{self.nid()}" value="{esc(label)}" style="edgeLabel;html=1;align=center;'
                              f'verticalAlign=middle;resizable=0;points=[];fontSize=10;fontColor={color};'
                              f'labelBackgroundColor=#ffffff;" vertex="1" connectable="0" parent="{eid}">'
                              f'<mxGeometry x="{label_pos}" relative="1" as="geometry"><mxPoint as="offset"/>'
                              f'</mxGeometry></mxCell>')
        return pts

    def dot(self, x, y, color):
        self.vertex(None, "", f"ellipse;fillColor={color};strokeColor=none;", x - 4.5, y - 4.5, 9, 9)

    def text(self, x, y, w, h, html, size=12, bold=False, align="left"):
        self.vertex(None, html, f"text;html=1;fontSize={size};{'fontStyle=1;' if bold else ''}align={align};"
                                f"verticalAlign=middle;whiteSpace=wrap;", x, y, w, h)

    def xml(self, name):
        return (f'<mxfile host="Electron"><diagram id="arch" name="{esc(name)}"><mxGraphModel dx="1600" dy="1000" '
                f'grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" '
                f'pageScale="1" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
                f'{"".join(self.cells)}</root></mxGraphModel></diagram></mxfile>')


def rabbit_logo_style():
    if LOGO_SRC:
        s = open(LOGO_SRC, encoding="utf-8").read()
        m = re.search(r'style="(shape=image;[^"]*image=data:image/svg\+xml,[^"]*)"', s)
        if m:
            return m.group(1).replace("&quot;", '"').replace('"', "&quot;")
    return None


# ------------------------------------------------------------------ build
w = W()
segments = []  # (points, group, colour) for the self-check


def add(points, group, color):
    segments.append((points, group, color))


w.text(30, -120, 900, 50, "Architecture v3 — Limited Watches microservices", 28, True)

# clients
w.vertex("posthog", "PostHog<br><i>analytics</i>", f"rounded=1;whiteSpace=wrap;html=1;dashed=1;fillColor={SAAS[0]};"
         f"strokeColor={SAAS[1]};fontSize=11;", 40, -40, 180, 60)
w.vertex("frontend", "<b>User / Admin Frontend</b>", "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;"
         "strokeColor=#6c8ebf;fontSize=12;", 40, 60, 180, 60)
w.vertex("gateway", "<b>API Gateway</b>", "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;"
         "fontSize=12;", 40, TRUNK_Y - 30, 180, 60)

# services
for svc in COLS:
    name, dbs = SERVICES[svc]
    x = col_x(svc)
    sid = w.vertex(svc, f"<b>{name}</b>", "rounded=1;whiteSpace=wrap;html=1;verticalAlign=top;spacingTop=4;"
                                         "fillColor=#ffffff;strokeColor=#333333;fontSize=13;", x, SY, SW, SH)
    if not dbs:
        w.vertex(None, "<i>stateless, no DB</i>", "text;html=1;align=center;verticalAlign=middle;fontSize=10;"
                                                  "fontColor=#666666;", 20, 44, SW - 40, 30, parent=sid)
    for i, db in enumerate(dbs):
        dx = SW / 2 - 34 * len(dbs) + 68 * i + 4
        w.vertex(None, db, "shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=7;"
                           "fontSize=9;fillColor=#f5f5f5;strokeColor=#666666;", dx, 34, 60, 46, parent=sid)

# external services
for key, (label, (fill, stroke), svc, slot) in EXTERNALS.items():
    x, y, ww, hh = ext_box(key)
    w.vertex(key, label, f"rounded=1;whiteSpace=wrap;html=1;dashed=1;fillColor={fill};strokeColor={stroke};"
                         f"fontSize=10;", x, y, ww, hh)

BLACK = "#222222"
# ---- HTTP: frontend <-> gateway, frontend -> posthog, frontend -> realtime
fx, fy, fw, fh = w.boxes["frontend"]
gx, gy, gw_, gh = w.boxes["gateway"]
add(w.edge("frontend", "gateway", [(fx + fw / 2, fy + fh), (gx + gw_ / 2, gy)], start="blockThin", label="HTTP"),
    "fe-gw", BLACK)
add(w.edge("frontend", "posthog", [(fx + fw / 2, fy), (fx + fw / 2, -40 + 60)], label="events"), "fe-ph", BLACK)
rx, ry, rw, rh = w.boxes["supa_realtime"]
rt_x = rx + rw * 0.3
add(w.edge("frontend", "supa_realtime", [(fx + fw, fy + 20), (rt_x, fy + 20), (rt_x, ry)], start="blockThin",
           label="WebSocket (chat)", label_pos=-0.55), "fe-rt", BLACK)

# ---- gateway trunk
trunk_pts = []
for svc in COLS:
    px = col_x(svc) + GW_PORT
    trunk_pts.append(px)
    add(w.edge("gateway", svc, [(gx + gw_, TRUNK_Y), (px, TRUNK_Y), (px, SY)]), "trunk", BLACK)
for px in trunk_pts[:-1]:
    w.dot(px, TRUNK_Y, BLACK)
w.text(gx + gw_ + 6, TRUNK_Y - 22, 120, 18, "HTTP (REST)", 10)

# ---- service -> service HTTP
def side_link(src, dst, label="HTTP"):
    sx, dx = col_x(src), col_x(dst)
    y = SY + SH / 2
    a, b = (sx + SW, dx) if sx < dx else (sx, dx + SW)
    add(w.edge(src, dst, [(a, y), (b, y)], label=label), f"{src}-{dst}", BLACK)


side_link("authorization", "users")
side_link("messaging", "catalog")
side_link("auctions", "catalog")


def over_link(src, src_off, dst, dst_off):
    s, d = col_x(src) + src_off, col_x(dst) + dst_off
    add(w.edge(src, dst, [(s, SY), (s, CAT_Y), (d, CAT_Y), (d, SY)]), f"{src}-{dst}", BLACK)


over_link("editorial", 182, "catalog", 8)
over_link("orders", 8, "catalog", 182)

# ---- external links (service top <-> external bottom)
def ext_link(svc, key, frac=0.5, label=None, inbound=False):
    x, y, ww, hh = ext_box(key)
    px = x + ww * frac
    pts = [(px, SY), (px, y + hh)]
    if inbound:
        pts = pts[::-1]
        add(w.edge(key, svc, pts, label=label, label_pos=-0.45), f"{svc}-{key}", BLACK)
    else:
        add(w.edge(svc, key, pts, label=label, label_pos=0.45), f"{svc}-{key}", BLACK)


ext_link("authorization", "supa_auth", 0.4, "verify JWT")
ext_link("users", "supa_hook", 0.5, "email-confirmed", inbound=True)
ext_link("users", "supa_store_users", 0.5)
ext_link("editorial", "supa_store_editorial", 0.3)
ext_link("messaging", "supa_realtime", 0.3, "broadcast")
ext_link("catalog", "supa_store_catalog", 0.5)
ext_link("catalog", "ai", 0.5)
ext_link("orders", "ipapi", 0.3)
ext_link("payment", "stripe", 0.25, "API")
ext_link("payment", "stripe", 0.75, "webhook", inbound=True)
ext_link("notif", "resend", 0.3)

# ---- RabbitMQ exchanges + coloured buses
logo = rabbit_logo_style()
ex_boxes = {}
for name, (pub, color, events) in EXCHANGES.items():
    cx = col_x(pub) + SW / 2
    width = 300 if name == "user.events" else 250
    rows = 1 + len(events)
    h = (26 if logo else 0) + 24 + 36 * len(events)
    x = cx - width / 2
    eid = w.vertex(name, "", f"swimlane;startSize=0;childLayout=stackLayout;horizontal=1;horizontalStack=0;"
                             f"resizeParent=1;resizeLast=0;collapsible=0;marginBottom=0;html=1;fillColor=#ffffff;"
                             f"strokeColor={color};strokeWidth=2;rounded=1;arcSize=4;", x, EX_Y, width, h)
    yy = 0
    if logo:
        w.vertex(None, "", logo, 0, 0, 171, 26, parent=eid)
        yy = 26
    w.vertex(None, f'<b>exchange: <font color="{color}">{name}</font></b>',
             "text;html=1;align=left;verticalAlign=middle;spacingLeft=8;fontSize=12;", 0, yy, width, 24, parent=eid)
    yy += 24
    for ev, cons in events:
        who = ", ".join(NAME[c] for c in cons)
        w.vertex(None, f"<b>{ev}</b><br><font color=\"#555555\" style=\"font-size:10px\">&#8594; {who}</font>",
                 "text;html=1;align=left;verticalAlign=middle;spacingLeft=8;fontSize=11;whiteSpace=wrap;",
                 0, yy, width, 36, parent=eid)
        yy += 36
    ex_boxes[name] = (x, width, cx)

# consumers per exchange, and bottom ports per service
consumers = {n: sorted({c for _, cs in ev for c in cs}, key=COLS.index) for n, (_, _, ev) in EXCHANGES.items()}
bottom_items = {s: [] for s in COLS}  # service -> list of (sort key, item)
for n, (pub, _, _) in EXCHANGES.items():
    bottom_items[pub].append((ex_boxes[n][2], ("pub", n)))
    for c in consumers[n]:
        bottom_items[c].append((ex_boxes[n][2], ("con", n)))
port_x = {}
for s, items in bottom_items.items():
    items.sort()
    for i, (_, it) in enumerate(items):
        port_x[(s, it)] = col_x(s) + SW * (i + 1) / (len(items) + 1)

# exchange exit port: towards the side with more consumer span
exit_x = {}
for n, (pub, _, _) in EXCHANGES.items():
    x, width, cx = ex_boxes[n]
    xs = [port_x[(c, ("con", n))] for c in consumers[n]]
    left = sum(1 for v in xs if v < cx)
    exit_x[n] = cx + (-1 if left > len(xs) - left else 1) * width * 0.32


def bus_span(n):
    xs = [port_x[(c, ("con", n))] for c in consumers[n]] + [exit_x[n]]
    return min(xs), max(xs)


def crossings(order):
    y = {n: TRACK_Y0 + i * TRACK_SP for i, n in enumerate(order)}
    total = 0
    for a in order:
        verts = [(port_x[(c, ("con", a))], y[a], SY + SH) for c in consumers[a]]  # drop: track -> service
        verts.append((exit_x[a], EX_Y, y[a]))                                    # exit: exchange -> track
        for b in order:
            if a == b:
                continue
            lo, hi = bus_span(b)
            for vx, y1, y2 in verts:
                if lo < vx < hi and min(y1, y2) < y[b] < max(y1, y2):
                    total += 1
    return total


from itertools import permutations
best = min(permutations(EXCHANGES), key=crossings)
track_y = {n: TRACK_Y0 + i * TRACK_SP for i, n in enumerate(best)}
print("track order", best, "crossings", crossings(best))

for n, (pub, color, _) in EXCHANGES.items():
    # publish: straight down into the exchange
    px = port_x[(pub, ("pub", n))]
    add(w.edge(pub, n, [(px, SY + SH), (px, EX_Y)], color=color, width=2, label="publish", label_pos=0.62,
               dashed=True),
        f"pub-{n}", color)
    ty, ex = track_y[n], exit_x[n]
    xs = []
    for c in consumers[n]:
        cx = port_x[(c, ("con", n))]
        xs.append(cx)
        add(w.edge(n, c, [(ex, EX_Y), (ex, ty), (cx, ty), (cx, SY + SH)], color=color, width=2), f"bus-{n}", color)
    lo, hi = min(xs + [ex]), max(xs + [ex])
    for v in sorted(set(xs + [ex])):
        if lo < v < hi:
            w.dot(v, ty, color)

# ---- legend
LX, LY = 2000, -100
lw, lh = 900, 230
w.vertex(None, "", "rounded=1;arcSize=4;fillColor=#ffffff;strokeColor=#999999;html=1;", LX, LY, lw, lh)
w.text(LX + 16, LY + 8, 200, 24, "Legend", 15, True)
w.edge(None, None, [(LX + 20, LY + 52), (LX + 90, LY + 52)])
w.text(LX + 100, LY + 42, 330, 20, "synchronous HTTP call (arrow = callee)")
w.dot(LX + 55, LY + 80, BLACK)
w.text(LX + 100, LY + 70, 330, 20, "lines branch / merge here")
w.vertex(None, "Supabase", f"rounded=1;dashed=1;fillColor={SUPA[0]};strokeColor={SUPA[1]};fontSize=10;html=1;",
         LX + 20, LY + 98, 70, 26)
w.text(LX + 100, LY + 101, 330, 20, "external SaaS (Supabase)")
w.vertex(None, "SaaS", f"rounded=1;dashed=1;fillColor={SAAS[0]};strokeColor={SAAS[1]};fontSize=10;html=1;",
         LX + 20, LY + 132, 70, 26)
w.text(LX + 100, LY + 135, 330, 20, "other external SaaS")
w.vertex(None, "DB", "shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=6;fontSize=9;"
                     "fillColor=#f5f5f5;strokeColor=#666666;", LX + 35, LY + 164, 40, 40)
w.text(LX + 100, LY + 174, 330, 20, "database owned by the service")
w.text(LX + 450, LY + 36, 430, 20, "<b>Asynchronous events (RabbitMQ)</b> — one colour per exchange")
w.edge(None, None, [(LX + 460, LY + 64), (LX + 530, LY + 64)], color="#555555", width=2, dashed=True)
w.text(LX + 540, LY + 54, 340, 20, "publish: service → its exchange")
w.edge(None, None, [(LX + 530, LY + 88), (LX + 460, LY + 88)], color="#555555", width=2)
w.text(LX + 540, LY + 78, 340, 20, "consume: exchange → consumer (arrow = consumer)")
for i, (n, (_, color, _)) in enumerate(EXCHANGES.items()):
    yy = LY + 116 + (i // 2) * 24
    xx = LX + 460 + (i % 2) * 210
    w.edge(None, None, [(xx, yy), (xx + 50, yy)], color=color, width=3, end="none")
    w.text(xx + 58, yy - 10, 150, 20, f'<font color="{color}"><b>{n}</b></font>')

with open(OUT, "w", encoding="utf-8") as f:
    f.write(w.xml("Architecture v3"))

# ------------------------------------------------------------------ self-check: lines through boxes, collinear overlaps
def seg_hits_box(p, q, box, pad=1.5):
    x, y, ww, hh = box
    x1, x2 = sorted((p[0], q[0]))
    y1, y2 = sorted((p[1], q[1]))
    return x1 < x + ww - pad and x2 > x + pad and y1 < y + hh - pad and y2 > y + pad


warn = 0
for pts, group, _ in segments:
    for a, b in zip(pts, pts[1:]):
        for key, box in w.boxes.items():
            if seg_hits_box(a, b, box):
                print("WARN line through box:", group, key, a, b)
                warn += 1
segs = []
for pts, group, color in segments:
    for a, b in zip(pts, pts[1:]):
        segs.append((a, b, group))
for i in range(len(segs)):
    for j in range(i + 1, len(segs)):
        (a1, b1, g1), (a2, b2, g2) = segs[i], segs[j]
        if g1 == g2:
            continue
        if a1[1] == b1[1] and a2[1] == b2[1] and abs(a1[1] - a2[1]) < 8:
            lo1, hi1 = sorted((a1[0], b1[0]))
            lo2, hi2 = sorted((a2[0], b2[0]))
            if lo1 < hi2 + 8 and lo2 < hi1 + 8:
                print("WARN horizontal overlap:", g1, g2, a1[1])
                warn += 1
        if a1[0] == b1[0] and a2[0] == b2[0] and abs(a1[0] - a2[0]) < 8:
            lo1, hi1 = sorted((a1[1], b1[1]))
            lo2, hi2 = sorted((a2[1], b2[1]))
            if lo1 < hi2 + 8 and lo2 < hi1 + 8:
                print("WARN vertical overlap:", g1, g2, a1[0])
                warn += 1
print("wrote", OUT, "warnings:", warn)
