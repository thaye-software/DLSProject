export default async function ConfirmChangeEmailPage({
  searchParams,
}: {
  searchParams: { message?: string };
}) {
	const message = (await searchParams).message;

	return(
		<div>
			{message ? (
				<div className="flex flex-col items-center justify-center mt-26">
					<h1 className="text-3xl font-bold mb-4">Email Change Initiated</h1>
					<p className="text-lg">{message}.</p>
				</div>
			) : (
				<div className="flex flex-col items-center justify-center mt-26">
					<h1 className="text-3xl font-bold mb-4">Email Change Confirmed</h1>
					<p className="text-lg">Your email has been successfully changed.</p>
				</div>
			)}
		</div>
	)
}