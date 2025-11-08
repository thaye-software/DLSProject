export default async function Page({ params }: { params: Promise<{ watchId: string }> }) {
    const watchId = (await params).watchId;
    return(
        <div>
            the watch id: {watchId}
        </div>
    )
}