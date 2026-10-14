"""Generates docs/erd.drawio (+ optional SVG previews) with hand-routed orthogonal crow's-foot connectors.

Usage: python docs/generate_erd.py docs/erd.drawio [svg-preview-prefix]
Table definitions mirror limited-watches/src/database/schema.ts; update TABLES/FKS when the schema changes.

Layout model: tables sit in columns; every connector leaves its FK row horizontally, runs
vertically in a lane inside the gap next to it, and enters the referenced row/header
horizontally. Connectors to the same target port share a lane (a "bus") with junction dots.
"""
import sys
from collections import defaultdict
from xml.sax.saxutils import escape as _esc

OUT_DRAWIO = sys.argv[1]
OUT_SVG_PREFIX = sys.argv[2] if len(sys.argv) > 2 else None


def esc(s):
    return _esc(s, {'"': "&quot;"})


COLORS = {
    "users": ("#dae8fc", "#6c8ebf"),
    "catalog": ("#d5e8d4", "#82b366"),
    "orders": ("#ffe6cc", "#d79b00"),
    "localization": ("#fff2cc", "#d6b656"),
    "messaging": ("#e1d5e7", "#9673a6"),
    "editorial": ("#f8cecc", "#b85450"),
    "auctions": ("#b0e3e6", "#0e8088"),
    "payment": ("#eeeeee", "#666666"),
    "notif": ("#eeeeee", "#666666"),
}
REF_COLOR = "#d6001c"

TABLES = {
    "users": ("users", [
        ("id", "uuid", "PK"), ("username", "varchar", ""), ("first_name", "varchar", ""),
        ("middle_name", "varchar", ""), ("last_name", "varchar", ""), ("phone", "varchar", ""),
        ("email", "varchar", ""), ("avatar_url", "text", ""), ("role", "varchar", ""),
        ("country_id", "uuid", "FK"), ("address_id", "uuid", "FK"), ("deleted_at", "timestamp", "")]),
    "addresses": ("users", [
        ("id", "uuid", "PK"), ("user_id", "uuid", "FK"), ("address_line_1", "varchar", ""),
        ("address_line_2", "varchar", ""), ("city", "varchar", ""), ("zip_code", "varchar", ""),
        ("state_province", "varchar", "")]),
    "favorites": ("users", [
        ("id", "uuid", "PK"), ("user_id", "uuid", "FK"), ("product_id", "uuid", "FK"),
        ("created_at", "timestamp", "")]),
    "products": ("catalog", [
        ("id", "uuid", "PK"), ("product_type", "varchar", ""), ("name", "varchar", ""),
        ("price_dkk", "bigint", ""), ("description", "text", ""), ("stock", "integer", ""),
        ("visible", "boolean", ""), ("created_at", "timestamp", "")]),
    "watches": ("catalog", [
        ("id", "uuid", "PK"), ("internal_id", "text", ""), ("product_id", "uuid", "FK"),
        ("brand_id", "uuid", "FK"), ("model", "varchar", ""), ("slug", "text", ""),
        ("reference", "varchar", ""), ("serial_number", "varchar", ""), ("year", "integer", ""),
        ("size", "integer", ""), ("movement", "varchar", ""), ("glass_type", "varchar", ""),
        ("limited", "boolean", ""), ("box", "boolean", ""), ("papers", "boolean", ""),
        ("condition", "integer", ""), ("bracelet_type", "varchar", ""),
        ("bracelet_color", "varchar", ""), ("dial_color", "varchar", ""), ("vat", "integer", "")]),
    "brands": ("catalog", [
        ("id", "uuid", "PK"), ("slug", "text", ""), ("name", "varchar", ""), ("country", "varchar", ""),
        ("address_line_1", "varchar", ""), ("address_line_2", "varchar", ""), ("zip_code", "varchar", ""),
        ("city", "varchar", ""), ("state_province", "varchar", ""), ("phone_number", "varchar", ""),
        ("email", "varchar", ""), ("website", "varchar", "")]),
    "product_images": ("catalog", [
        ("id", "uuid", "PK"), ("product_id", "uuid", "FK"), ("image_url", "varchar", ""),
        ("is_thumbnail", "boolean", "")]),
    "orders": ("orders", [
        ("id", "uuid", "PK"), ("user_id", "uuid", "FK"), ("status", "varchar", ""),
        ("currency_id", "uuid", "FK"), ("shipping_price_dkk", "decimal", ""),
        ("shipping_price_currency", "decimal", ""), ("sub_total_dkk", "decimal", ""),
        ("total_price_dkk", "decimal", ""), ("total_price_currency", "decimal", ""),
        ("delivery_address_id", "uuid", "FK"), ("billing_address_id", "uuid", "FK"),
        ("created_at", "timestamp", "")]),
    "order_items": ("orders", [
        ("id", "uuid", "PK"), ("order_id", "uuid", "FK"), ("product_id", "uuid", "FK"),
        ("quantity", "integer", "")]),
    "order_addresses": ("orders", [
        ("id", "uuid", "PK"), ("first_name", "varchar", ""), ("middle_name", "varchar", ""),
        ("last_name", "varchar", ""), ("address_line_1", "varchar", ""), ("address_line_2", "varchar", ""),
        ("city", "varchar", ""), ("zip_code", "varchar", ""), ("state_province", "varchar", ""),
        ("country", "varchar", "")]),
    "currencies": ("localization", [
        ("id", "uuid", "PK"), ("code", "varchar(3)", ""), ("exchange_rate", "decimal", ""),
        ("is_active", "boolean", ""), ("updated_at", "timestamp", "")]),
    "currency_history": ("localization", [
        ("id", "uuid", "PK"), ("currency_id", "uuid", "FK"), ("exchange_rate", "decimal", ""),
        ("changed_at", "timestamp", ""), ("changed_by", "varchar", "")]),
    "countries": ("localization", [
        ("id", "uuid", "PK"), ("name", "varchar", ""), ("abbreviation", "varchar", ""),
        ("currency_id", "uuid", "FK"), ("vat_rate", "integer", "")]),
    "conversations": ("messaging", [
        ("id", "uuid", "PK"), ("customer_id", "uuid", "FK"), ("product_id", "uuid", "FK"),
        ("status", "text", ""), ("created_at", "timestamp", ""), ("updated_at", "timestamp", "")]),
    "messages": ("messaging", [
        ("id", "uuid", "PK"), ("conversation_id", "uuid", "FK"), ("sender_id", "uuid", "FK"),
        ("username", "text", ""), ("sender_type", "text", ""), ("content", "text", ""),
        ("is_read", "boolean", ""), ("created_at", "timestamp", "")]),
    "blog_posts": ("editorial", [
        ("id", "uuid", "PK"), ("title", "varchar", ""), ("content", "text", ""),
        ("author_id", "uuid", "FK"), ("created_at", "timestamp", "")]),
    "blog_media": ("editorial", [
        ("id", "uuid", "PK"), ("blog_id", "uuid", "FK"), ("media_url", "varchar", "")]),
    "auctions": ("auctions", [
        ("id", "uuid", "PK"), ("watch_id", "uuid", "FK"), ("starting_price", "bigint", ""),
        ("current_price", "bigint", ""), ("ends_at", "timestamp", "")]),
    # proposed tables (microservice page only)
    "bids": ("auctions", [
        ("id", "uuid", "PK"), ("auction_id", "uuid", "FK"), ("user_id", "uuid", "REF"),
        ("amount_dkk", "bigint", ""), ("created_at", "timestamp", "")]),
    "payments": ("payment", [
        ("id", "uuid", "PK"), ("order_id", "uuid", "REF"), ("stripe_payment_intent_id", "varchar", ""),
        ("amount", "bigint", ""), ("currency_code", "varchar(3)", ""), ("status", "varchar", ""),
        ("created_at", "timestamp", "")]),
    "recipients": ("notif", [
        ("user_id", "uuid", "PK"), ("email", "varchar", ""), ("username", "varchar", ""),
        ("email_notifications", "boolean", ""), ("updated_at", "timestamp", "")]),
}
PROPOSED_TABLES = {"bids", "payments", "recipients"}

# (child table, FK column, parent table)
FKS = [
    ("users", "country_id", "countries"), ("users", "address_id", "addresses"),
    ("addresses", "user_id", "users"),
    ("favorites", "user_id", "users"), ("favorites", "product_id", "products"),
    ("watches", "product_id", "products"), ("watches", "brand_id", "brands"),
    ("product_images", "product_id", "products"),
    ("orders", "user_id", "users"), ("orders", "currency_id", "currencies"),
    ("orders", "delivery_address_id", "order_addresses"), ("orders", "billing_address_id", "order_addresses"),
    ("order_items", "order_id", "orders"), ("order_items", "product_id", "products"),
    ("currency_history", "currency_id", "currencies"), ("countries", "currency_id", "currencies"),
    ("conversations", "customer_id", "users"), ("conversations", "product_id", "products"),
    ("messages", "conversation_id", "conversations"), ("messages", "sender_id", "users"),
    ("blog_posts", "author_id", "users"), ("blog_media", "blog_id", "blog_posts"),
    ("auctions", "watch_id", "watches"),
]
NEW_FKS = [("bids", "auction_id", "auctions"), ("bids", "user_id", "users"),
           ("payments", "order_id", "orders"), ("recipients", "user_id", "users")]
NULLABLE = {("users", "country_id"), ("users", "address_id"), ("orders", "delivery_address_id"),
            ("orders", "billing_address_id"), ("blog_posts", "author_id"), ("product_images", "product_id")}
ONE_TO_ONE = {("watches", "product_id"), ("recipients", "user_id")}
CROSS = {("favorites", "product_id"), ("orders", "user_id"), ("order_items", "product_id"),
         ("conversations", "customer_id"), ("conversations", "product_id"), ("messages", "sender_id"),
         ("blog_posts", "author_id"), ("auctions", "watch_id"), ("users", "country_id"),
         ("bids", "user_id"), ("payments", "order_id"), ("recipients", "user_id")}
EXTRA_COLS = {"order_items": [("product_name", "varchar", "NEW"), ("unit_price_dkk", "bigint", "NEW")]}

TW, ROW_H, HEAD_H = 250, 20, 28
PAD, LABEL_H = 20, 34
MARGIN, LANE_SP, MIN_GAP = 46, 18, 150

# table -> (column, top y). Same positions on both pages so before/after line up.
POS = {
    "users": (1, 0), "addresses": (2, 20), "favorites": (2, 220),
    "products": (3, 0), "watches": (3, 300), "product_images": (4, -20), "brands": (4, 350),
    "countries": (0, 410), "currencies": (0, 590), "currency_history": (0, 750),
    "orders": (1, 430), "order_items": (2, 410), "order_addresses": (2, 590),
    "messages": (1, 970), "conversations": (2, 1030),
    "blog_posts": (0, 970), "blog_media": (0, 1130),
    "auctions": (2, 1290),
    "bids": (1, 1270), "payments": (0, 1310), "recipients": (1, 1510),
}
# same-column connectors: which side they leave/enter on
SAME_COL_SIDE = {("watches", "product_id"): "L", ("orders", "user_id"): "R",
                 ("messages", "sender_id"): "R", ("countries", "currency_id"): "L",
                 ("currency_history", "currency_id"): "L", ("blog_media", "blog_id"): "L",
                 ("bids", "user_id"): "R", ("recipients", "user_id"): "R"}


def cols_of(t, ms):
    cols = list(TABLES[t][1])
    if ms:
        cols = [(n, ty, ("PK REF" if k == "PK" else "REF") if (t, n) in CROSS else k) for n, ty, k in cols] + EXTRA_COLS.get(t, [])
    return cols


def theight(t, ms):
    return HEAD_H + ROW_H * len(cols_of(t, ms))


class Page:
    def __init__(self, pid, name, ms):
        self.pid, self.name, self.ms = pid, name, ms
        self.tables = [t for t in POS if ms or t not in PROPOSED_TABLES]
        fks = FKS + (NEW_FKS if ms else [])
        self.edges = []
        for s, c, d in fks:
            cross = ms and (s, c) in CROSS
            self.edges.append(dict(src=s, col=c, dst=d, cross=cross,
                                   start="ERzeroToOne" if (s, c) in ONE_TO_ONE else "ERzeroToMany",
                                   end="ERzeroToOne" if (s, c) in NULLABLE else "ERmandOne"))

    # ---- geometry helpers
    def row_y(self, t, col):
        names = [n for n, _, _ in cols_of(t, self.ms)]
        return POS[t][1] + HEAD_H + ROW_H * names.index(col) + ROW_H / 2

    def route(self):
        groups = defaultdict(list)  # key -> list of edges
        for e in self.edges:
            cs, cd = POS[e["src"]][0], POS[e["dst"]][0]
            if cd == cs + 1:
                ss, ds, gap = "R", "L", cs
            elif cd == cs - 1:
                ss, ds, gap = "L", "R", cd
            elif cd == cs:
                ss = ds = SAME_COL_SIDE[(e["src"], e["col"])]
                gap = cs if ss == "R" else cs - 1
            else:
                raise SystemExit(f"non-adjacent connector {e}")
            e.update(ss=ss, ds=ds, gap=gap, sy=self.row_y(e["src"], e["col"]),
                     ty=(POS[e["dst"]][1] + HEAD_H / 2) if e["cross"] else self.row_y(e["dst"], "id"))
            key = (gap, e["dst"], e["cross"], ds)
            for o in groups[key]:
                if o["end"] != e["end"]:
                    raise SystemExit(f"marker conflict at {key}: {o['col']} vs {e['col']}")
            groups[key].append(e)
        self.groups = groups
        # lanes per gap
        by_gap = defaultdict(list)
        for key, es in groups.items():
            att = [(e["ss"], e["sy"]) for e in es] + [(es[0]["ds"], es[0]["ty"])]
            # side relative to the gap: a source leaving "R" sits on the gap's left column
            sides = [1 if (s == "L") else 0 for s, _ in att]  # 1 = attached to right column of gap
            ys = [y for _, y in att]
            span = max(ys) - min(ys)
            score = sum(sides) / len(sides)
            by_gap[key[0]].append((score, span if score < 0.5 else -span, key))
        self.lane_index, self.gap_lanes = {}, {}
        for g, items in by_gap.items():
            items.sort()
            for i, (_, _, key) in enumerate(items):
                self.lane_index[key] = i
            self.gap_lanes[g] = len(items)
        # column x positions
        ncols = max(c for c, _ in POS.values()) + 1
        self.colx = [0.0] * ncols
        outer = self.gap_lanes.get(-1, 0)
        self.colx[0] = MARGIN + max(outer - 1, 0) * LANE_SP + 40 if outer else 0
        for c in range(1, ncols):
            n = self.gap_lanes.get(c - 1, 0)
            self.gap_w = max(MIN_GAP, 2 * MARGIN + max(n - 1, 0) * LANE_SP)
            self.colx[c] = self.colx[c - 1] + TW + max(MIN_GAP, 2 * MARGIN + max(n - 1, 0) * LANE_SP)

    def lane_x(self, key):
        g, i = key[0], self.lane_index[key]
        if g == -1:
            return self.colx[0] - MARGIN - (self.gap_lanes[-1] - 1 - i) * LANE_SP
        n = self.gap_lanes[g]
        left, right = self.colx[g] + TW, self.colx[g + 1]
        width = (n - 1) * LANE_SP
        start = (left + right) / 2 - width / 2
        return start + i * LANE_SP

    def tx(self, t):
        return self.colx[POS[t][0]]

    def polylines(self):
        out = []
        for key, es in self.groups.items():
            lx = self.lane_x(key)
            for e in es:
                sx = self.tx(e["src"]) + (TW if e["ss"] == "R" else 0)
                dx = self.tx(e["dst"]) + (TW if e["ds"] == "R" else 0)
                out.append((e, [(sx, e["sy"]), (lx, e["sy"]), (lx, e["ty"]), (dx, e["ty"])]))
        return out

    def junctions(self):
        dots = []
        for key, es in self.groups.items():
            if len(es) < 2:
                continue
            lx = self.lane_x(key)
            ys = [e["sy"] for e in es] + [es[0]["ty"]]
            lo, hi = min(ys), max(ys)
            for y in sorted(set(ys)):
                if lo < y < hi:
                    dots.append((lx, y, es[0]["cross"]))
        return dots

    def check(self):
        warn = []
        hs = defaultdict(list)
        for e, pts in self.polylines():
            key = (e["gap"], e["dst"], e["cross"], e["ds"])
            hs[e["gap"]].append((pts[0][1], key))
            hs[e["gap"]].append((pts[3][1], key))
        for g, lst in hs.items():
            for i in range(len(lst)):
                for j in range(i + 1, len(lst)):
                    (y1, k1), (y2, k2) = lst[i], lst[j]
                    if k1 != k2 and abs(y1 - y2) < 12:
                        warn.append(f"gap {g}: near-collinear y={y1}/{y2} {k1[1]} vs {k2[1]}")
        boxes = [(t, self.tx(t), POS[t][1], TW, theight(t, self.ms)) for t in self.tables]
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                if a[1] < b[1] + b[3] and b[1] < a[1] + a[3] and a[2] < b[2] + b[4] + 20 and b[2] < a[2] + a[4] + 20:
                    warn.append(f"tables too close: {a[0]} {b[0]}")
        return warn


# ------------------------------------------------------------------ containers
MONO_GROUPS = [
    ("Users / Identity", "users", ["users", "addresses", "favorites"]),
    ("Catalog", "catalog", ["products", "watches", "brands", "product_images"]),
    ("Localization (currency, VAT)", "localization", ["countries", "currencies", "currency_history"]),
    ("Orders", "orders", ["orders", "order_items", "order_addresses"]),
    ("Messaging", "messaging", ["messages", "conversations"]),
    ("Editorial", "editorial", ["blog_posts", "blog_media"]),
    ("Auctions", "auctions", ["auctions"]),
]
MS_GROUPS = [
    ("Users service · PostgreSQL", "users", ["users", "addresses", "favorites"]),
    ("Catalog service · PostgreSQL", "catalog", ["products", "watches", "brands", "product_images"]),
    ("Orders service · PostgreSQL (incl. localization tables)", "orders",
     ["countries", "currencies", "currency_history", "orders", "order_items", "order_addresses"]),
    ("Messaging service · MongoDB", "messaging", ["messages", "conversations"]),
    ("Editorial service · MongoDB", "editorial", ["blog_posts", "blog_media"]),
    ("Auctions service", "auctions", ["bids", "auctions"]),
    ("Payment service", "payment", ["payments"]),
    ("Notification / Email service", "notif", ["recipients"]),
]


def container_box(p, tables):
    xs = [p.tx(t) for t in tables]
    ys = [POS[t][1] for t in tables]
    ye = [POS[t][1] + theight(t, p.ms) for t in tables]
    return min(xs) - PAD, min(ys) - PAD - LABEL_H, max(xs) + TW + PAD - (min(xs) - PAD), max(ye) + PAD - (min(ys) - PAD - LABEL_H)


def check_containers(p, groups):
    warn = []
    boxes = [(label, container_box(p, ts), set(ts)) for label, _, ts in groups]
    for label, (x, y, w, h), own in boxes:
        for t in p.tables:
            if t in own:
                continue
            tx, ty, th = p.tx(t), POS[t][1], theight(t, p.ms)
            if tx < x + w and x < tx + TW and ty < y + h and y < ty + th:
                warn.append(f"container {label} overlaps table {t}")
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            (l1, a, _), (l2, b, _) = boxes[i], boxes[j]
            if a[0] < b[0] + b[2] and b[0] < a[0] + a[2] and a[1] < b[1] + b[3] and b[1] < a[1] + a[3]:
                warn.append(f"containers overlap: {l1} / {l2}")
    return warn


# ------------------------------------------------------------------ draw.io output
class DrawioWriter:
    def __init__(self, p):
        self.p, self.cells, self.n, self.rowid, self.tid = p, [], 0, {}, {}

    def nid(self):
        self.n += 1
        return f"{self.p.pid}-{self.n}"

    def add(self, s):
        self.cells.append(s)

    def vertex(self, value, style, x, y, w, h, parent="1"):
        i = self.nid()
        self.add(f'<mxCell id="{i}" value="{esc(value)}" style="{style}" vertex="1" parent="{parent}">'
                 f'<mxGeometry x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" as="geometry"/></mxCell>')
        return i

    def container(self, label, color, tables, dashed=False):
        fill, stroke = COLORS[color]
        x, y, w, h = container_box(self.p, tables)
        self.vertex(label, f"rounded=1;arcSize=3;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};"
                           f"opacity=40;verticalAlign=top;align=left;spacingLeft=12;spacingTop=6;fontStyle=1;"
                           f"fontSize=15;{'dashed=1;' if dashed else ''}", x, y, w, h)

    def table(self, t):
        mod, _ = TABLES[t]
        fill, stroke = COLORS[mod]
        cols = cols_of(t, self.p.ms)
        proposed = t in PROPOSED_TABLES
        title = t + (" (proposed)" if proposed else "")
        tid = self.vertex(title, f"swimlane;fontStyle=1;childLayout=stackLayout;horizontal=1;startSize={HEAD_H};"
                                 f"horizontalStack=0;resizeParent=1;resizeLast=0;collapsible=0;marginBottom=0;"
                                 f"fillColor={fill};strokeColor={stroke};swimlaneFillColor=#ffffff;html=1;"
                                 f"{'dashed=1;' if proposed else ''}",
                          self.p.tx(t), POS[t][1], TW, theight(t, self.p.ms))
        self.tid[t] = tid
        for i, (name, typ, k) in enumerate(cols):
            extra = ""
            if k == "PK":
                extra = "fontStyle=1;"
            elif k == "PK REF":
                extra = f"fontStyle=1;fontColor={REF_COLOR};"
            elif k == "REF":
                extra = f"fontColor={REF_COLOR};"
            elif k == "NEW":
                extra = "fontStyle=2;fontColor=#0050ef;"
            label = (f"{k} " if k in ("PK", "FK", "REF", "PK REF") else "") + f"{name}: {typ}" + (" (new)" if k == "NEW" else "")
            rid = self.vertex(label, "text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;"
                                     "spacingLeft=6;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];"
                                     f"portConstraint=eastwest;fontSize=11;{extra}html=1;",
                              0, HEAD_H + i * ROW_H, TW, ROW_H, parent=tid)
            self.rowid[(t, name)] = rid

    def edge(self, e, pts):
        src = self.rowid[(e["src"], e["col"])]
        if e["cross"]:
            dst = self.tid[e["dst"]]
            ey = (HEAD_H / 2) / theight(e["dst"], self.p.ms)
        else:
            dst, ey = self.rowid[(e["dst"], "id")], 0.5
        ex_ = 1 if e["ss"] == "R" else 0
        en_ = 1 if e["ds"] == "R" else 0
        color = f"strokeColor={REF_COLOR};" if e["cross"] else "strokeColor=#222222;"
        style = (f"edgeStyle=none;rounded=0;html=1;endArrow={e['end']};startArrow={e['start']};endFill=0;startFill=0;"
                 f"endSize=12;startSize=12;strokeWidth=1.5;{color}"
                 f"exitX={ex_};exitY=0.5;exitDx=0;exitDy=0;exitPerimeter=0;"
                 f"entryX={en_};entryY={ey:.4f};entryDx=0;entryDy=0;entryPerimeter=0;")
        mids = "".join(f'<mxPoint x="{x:.1f}" y="{y:.1f}"/>' for x, y in pts[1:3])
        self.add(f'<mxCell id="{self.nid()}" style="{style}" edge="1" parent="1" source="{src}" target="{dst}">'
                 f'<mxGeometry relative="1" as="geometry"><Array as="points">{mids}</Array></mxGeometry></mxCell>')

    def dot(self, x, y, cross):
        c = REF_COLOR if cross else "#222222"
        self.vertex("", f"ellipse;fillColor={c};strokeColor=none;", x - 4, y - 4, 8, 8)

    def free_edge(self, x1, y1, x2, y2, start, end, cross=False):
        color = f"strokeColor={REF_COLOR};" if cross else "strokeColor=#222222;"
        self.add(f'<mxCell id="{self.nid()}" style="edgeStyle=none;html=1;endArrow={end};startArrow={start};'
                 f'endFill=0;startFill=0;endSize=12;startSize=12;strokeWidth=1.5;{color}" edge="1" parent="1">'
                 f'<mxGeometry relative="1" as="geometry"><mxPoint x="{x1}" y="{y1}" as="sourcePoint"/>'
                 f'<mxPoint x="{x2}" y="{y2}" as="targetPoint"/></mxGeometry></mxCell>')

    def text(self, x, y, w, h, html, size=12, bold=False):
        self.vertex(html, f"text;html=1;fontSize={size};{'fontStyle=1;' if bold else ''}align=left;"
                          f"verticalAlign=middle;whiteSpace=wrap;", x, y, w, h)

    def xml(self):
        return (f'<diagram id="{self.p.pid}" name="{esc(self.p.name)}"><mxGraphModel dx="1600" dy="1000" grid="1" '
                f'gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" '
                f'math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>{"".join(self.cells)}'
                f'</root></mxGraphModel></diagram>')


# ------------------------------------------------------------------ SVG preview (same geometry)
def svg_marker(kind, x, y, direction):
    """direction: +1 if the line continues to the right of the endpoint, -1 to the left."""
    d = direction
    out = []
    line = lambda x1, y1, x2, y2: out.append(
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#222" stroke-width="1.5"/>')
    circ = lambda cx: out.append(f'<circle cx="{cx}" cy="{y}" r="5" fill="#fff" stroke="#222" stroke-width="1.5"/>')
    if kind == "ERmandOne":
        line(x + d * 8, y - 7, x + d * 8, y + 7)
        line(x + d * 14, y - 7, x + d * 14, y + 7)
    elif kind == "ERzeroToOne":
        line(x + d * 8, y - 7, x + d * 8, y + 7)
        circ(x + d * 20)
    elif kind == "ERzeroToMany":
        line(x, y - 7, x + d * 12, y)
        line(x, y + 7, x + d * 12, y)
        circ(x + d * 20)
    return "".join(out)


def svg(p, groups, path, title):
    parts = []
    minx = min(p.tx(t) for t in p.tables) - 200
    maxx = max(p.tx(t) for t in p.tables) + TW + 500
    miny, maxy = -160, max(POS[t][1] + theight(t, p.ms) for t in p.tables) + 120
    for label, color, ts, *rest in groups:
        x, y, w, h = container_box(p, ts)
        f, s = COLORS[color]
        parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{f}" fill-opacity="0.4" stroke="{s}"/>'
                     f'<text x="{x + 12}" y="{y + 22}" font-weight="bold" font-size="15">{esc(label)}</text>')
    for t in p.tables:
        mod = TABLES[t][0]
        f, s = COLORS[mod]
        x, y, h = p.tx(t), POS[t][1], theight(t, p.ms)
        parts.append(f'<rect x="{x}" y="{y}" width="{TW}" height="{h}" fill="#fff" stroke="{s}"/>'
                     f'<rect x="{x}" y="{y}" width="{TW}" height="{HEAD_H}" fill="{f}" stroke="{s}"/>'
                     f'<text x="{x + TW / 2}" y="{y + 18}" text-anchor="middle" font-weight="bold">{t}</text>')
        for i, (n, ty, k) in enumerate(cols_of(t, p.ms)):
            col = REF_COLOR if k in ("REF", "PK REF") else ("#0050ef" if k == "NEW" else "#000")
            parts.append(f'<text x="{x + 6}" y="{y + HEAD_H + i * ROW_H + 14}" font-size="11" fill="{col}">'
                         f'{(k + " ") if k in ("PK", "FK", "REF", "PK REF") else ""}{n}: {ty}</text>')
    for e, pts in p.polylines():
        dash = f'stroke="{REF_COLOR}"' if e["cross"] else 'stroke="#222"'
        parts.append(f'<polyline points="{" ".join(f"{x},{y}" for x, y in pts)}" fill="none" {dash} stroke-width="1.5"/>')
        parts.append(svg_marker(e["start"], pts[0][0], pts[0][1], 1 if pts[1][0] > pts[0][0] else -1))
        parts.append(svg_marker(e["end"], pts[3][0], pts[3][1], 1 if pts[2][0] > pts[3][0] else -1))
    for x, y, cross in p.junctions():
        parts.append(f'<circle cx="{x}" cy="{y}" r="4" fill="{REF_COLOR if cross else "#222"}"/>')
    w, h = maxx - minx, maxy - miny
    doc = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{minx} {miny} {w} {h}" width="{w}" height="{h}" '
           f'font-family="Helvetica,Arial" font-size="12"><rect x="{minx}" y="{miny}" width="{w}" height="{h}" fill="#fff"/>'
           f'<text x="{minx + 20}" y="{miny + 50}" font-size="26" font-weight="bold">{esc(title)}</text>{"".join(parts)}</svg>')
    open(path, "w", encoding="utf-8").write(doc)


# ------------------------------------------------------------------ legend
def legend(w, x, y, items, ms):
    lines = 6 + len(items) + (3 if ms else 1)
    h = 40 + lines * 24
    w.vertex("", "rounded=1;arcSize=3;fillColor=#ffffff;strokeColor=#999999;html=1;", x, y, 420, h)
    w.text(x + 14, y + 8, 300, 24, "Legend", 15, True)
    cy = y + 44
    w.text(x + 14, cy - 10, 380, 20, "<b>Cardinality (crow's foot)</b>")
    cy += 22
    for start, end, label in [
        ("none", "ERmandOne", "exactly one (FK is NOT NULL)"),
        ("none", "ERzeroToOne", "zero or one (FK is nullable)"),
        ("none", "ERzeroToMany", "zero or many"),
    ]:
        w.free_edge(x + 100, cy, x + 20, cy, start, end)
        w.text(x + 115, cy - 10, 300, 20, label)
        cy += 24
    cy += 6
    w.free_edge(x + 100, cy, x + 20, cy, "none", "none")
    w.text(x + 115, cy - 10, 300, 20, "foreign key inside one database")
    cy += 24
    w.dot(x + 60, cy, False)
    w.text(x + 115, cy - 10, 300, 20, "lines merge (all point to the same key)")
    cy += 24
    if ms:
        w.free_edge(x + 100, cy, x + 20, cy, "none", "none", cross=True)
        w.text(x + 115, cy - 10, 300, 36, f'<font color="{REF_COLOR}"><b>Red</b> REF</font>: id owned by another service; no DB '
                                          "constraint; the line ends at the table header", 11)
        cy += 40
        w.text(x + 14, cy - 10, 400, 20, '<i><font color="#0050ef">blue italic</font></i> = proposed column, '
                                         "dashed table = proposed table", 11)
        cy += 26
    cy += 6
    w.text(x + 14, cy - 10, 380, 20, "<b>Colour = module the table belongs to</b>")
    cy += 22
    for color, label in items:
        f, s = COLORS[color]
        w.vertex("", f"rounded=0;fillColor={f};strokeColor={s};", x + 20, cy - 7, 30, 14)
        w.text(x + 60, cy - 10, 340, 20, label)
        cy += 24


ITEMS_MONO = [("users", "Users / Identity"), ("catalog", "Catalog"), ("orders", "Orders"),
              ("localization", "Localization (currency, VAT)"), ("messaging", "Messaging"),
              ("editorial", "Editorial"), ("auctions", "Auctions")]
ITEMS_MS = ITEMS_MONO[:3] + [("localization", "Localization tables (moved into Orders)")] + ITEMS_MONO[4:] + \
           [("payment", "Payment / Notification (new services)")]


def build(pid, name, ms, groups, title, items, svg_path):
    p = Page(pid, name, ms)
    p.route()
    warns = p.check() + check_containers(p, groups)
    for wmsg in warns:
        print(f"[{pid}] WARN {wmsg}")
    w = DrawioWriter(p)
    w.text(p.colx[0] - 40, -150, 1600, 40, title, 26, True)
    for label, color, ts in groups:
        w.container(label, color, ts, dashed=all(t in PROPOSED_TABLES for t in ts))
    for t in p.tables:
        w.table(t)
    for e, pts in p.polylines():
        w.edge(e, pts)
    for x, y, cross in p.junctions():
        w.dot(x, y, cross)
    lx = p.colx[3]
    if ms:
        w.vertex("<b>Search service · MongoDB + Redis</b><br>No tables of its own. Keeps a denormalised <i>watch</i> "
                 "read model (product + watch + brand + thumbnail) built from product_created / product_updated / "
                 "product_deleted events (CQRS read side).",
                 "shape=note;whiteSpace=wrap;html=1;size=14;align=left;verticalAlign=top;spacingLeft=8;spacingTop=4;"
                 "fillColor=#ffffff;strokeColor=#999999;fontSize=12;", lx, 800, 420, 100)
        legend(w, lx, 940, items, ms)
    else:
        legend(w, lx, 800, items, ms)
    if svg_path:
        svg(p, groups, svg_path, title)
    return w


mono = build("mono", "1 - Monolith ERD", False, MONO_GROUPS,
             "Limited Watches – Monolith ERD (one shared PostgreSQL database)", ITEMS_MONO, OUT_SVG_PREFIX and OUT_SVG_PREFIX + "-mono.svg")
ms = build("ms", "2 - Microservice ERD", True, MS_GROUPS,
           "Limited Watches – Microservice ERD (database per service)", ITEMS_MS, OUT_SVG_PREFIX and OUT_SVG_PREFIX + "-ms.svg")
with open(OUT_DRAWIO, "w", encoding="utf-8") as f:
    f.write('<mxfile host="Electron" type="device">' + mono.xml() + ms.xml() + "</mxfile>")
print("wrote", OUT_DRAWIO)
