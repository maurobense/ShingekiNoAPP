namespace ShingekiNoAPPI.Services.Email
{
    public interface IEmailSender
    {
        Task SendVerificationCodeAsync(string toEmail, string toName, string code, string tenantName, CancellationToken cancellationToken = default);
    }
}
