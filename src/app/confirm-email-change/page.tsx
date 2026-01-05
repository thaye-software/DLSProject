export default function ConfirmChangeEmailPage({
  searchParams,
}: {
  searchParams: { message?: string };
}) {
    const message = searchParams.message;

    return(
        <div className="flex flex-col items-center justify-center min-h-screen py-2">
            <h1 className="text-3xl font-bold mb-4">Email Change Confirmed</h1>
            <p className="text-lg">Your email address has been successfully updated.</p>

            <p>{message}</p>
        </div>
    )
}