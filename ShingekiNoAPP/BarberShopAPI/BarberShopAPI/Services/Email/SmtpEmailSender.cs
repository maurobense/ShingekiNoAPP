using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;
using ShingekiNoAPPI.Options;

namespace ShingekiNoAPPI.Services.Email
{
    public sealed class SmtpEmailSender : IEmailSender
    {
        private readonly SmtpEmailOptions _options;
        private readonly ILogger<SmtpEmailSender> _logger;

        public SmtpEmailSender(IOptions<SmtpEmailOptions> options, ILogger<SmtpEmailSender> logger)
        {
            _options = options.Value;
            _logger = logger;
        }

        public async Task SendVerificationCodeAsync(string toEmail, string toName, string code, string tenantName, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(_options.Username) || string.IsNullOrWhiteSpace(_options.Password))
            {
                _logger.LogWarning("SMTP no configurado. Codigo de verificacion para {Email}: {Code}", toEmail, code);
                return;
            }

            using var message = new MailMessage
            {
                From = new MailAddress(
                    string.IsNullOrWhiteSpace(_options.FromEmail) ? _options.Username : _options.FromEmail,
                    _options.FromName),
                Subject = $"Tu codigo de acceso a {tenantName}",
                IsBodyHtml = true,
                Body = BuildVerificationHtml(toName, code, tenantName)
            };
            message.To.Add(new MailAddress(toEmail, toName));

            using var client = new SmtpClient(_options.Host, _options.Port)
            {
                EnableSsl = _options.EnableSsl,
                Credentials = new NetworkCredential(_options.Username, _options.Password)
            };

            await client.SendMailAsync(message, cancellationToken);
        }

        private static string BuildVerificationHtml(string name, string code, string tenantName)
        {
            var displayName = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(name) ? "hola" : name.Trim());
            var safeTenant = WebUtility.HtmlEncode(tenantName);
            return $"""
                <div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#f6f7fb;padding:28px">
                  <div style="max-width:520px;margin:auto;background:#fff;border-radius:18px;padding:28px;border:1px solid #e8ebf2">
                    <p style="margin:0 0 10px;color:#687083">Kordena</p>
                    <h1 style="font-size:22px;margin:0 0 12px;color:#101828">Codigo para {safeTenant}</h1>
                    <p style="color:#475467;font-size:15px">Hola {displayName}, usa este codigo para confirmar tu cuenta. Vence en 1 minuto.</p>
                    <div style="font-size:34px;letter-spacing:8px;font-weight:800;color:#111827;background:#f2f4f7;border-radius:14px;padding:18px;text-align:center;margin:22px 0">{code}</div>
                    <p style="color:#98a2b3;font-size:13px;margin:0">Si no pediste este codigo, podes ignorar este email.</p>
                  </div>
                </div>
                """;
        }
    }
}
