using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Datos.Migrations
{
    /// <inheritdoc />
    public partial class CustomerAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'Email')
                    ALTER TABLE dbo.Clients ADD Email nvarchar(256) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'PasswordHash')
                    ALTER TABLE dbo.Clients ADD PasswordHash nvarchar(512) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'IsEmailVerified')
                    ALTER TABLE dbo.Clients ADD IsEmailVerified bit NOT NULL CONSTRAINT DF_Clients_IsEmailVerified DEFAULT 0;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'EmailVerificationCodeHash')
                    ALTER TABLE dbo.Clients ADD EmailVerificationCodeHash nvarchar(128) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'EmailVerificationCodeExpiresAt')
                    ALTER TABLE dbo.Clients ADD EmailVerificationCodeExpiresAt datetime2 NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'EmailVerificationLastSentAt')
                    ALTER TABLE dbo.Clients ADD EmailVerificationLastSentAt datetime2 NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'EmailVerificationFailedAttempts')
                    ALTER TABLE dbo.Clients ADD EmailVerificationFailedAttempts int NOT NULL CONSTRAINT DF_Clients_EmailVerificationFailedAttempts DEFAULT 0;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'LastLoginAt')
                    ALTER TABLE dbo.Clients ADD LastLoginAt datetime2 NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'IX_Clients_BranchId_Email')
                    EXEC('CREATE UNIQUE INDEX IX_Clients_BranchId_Email
                    ON dbo.Clients(BranchId, Email)
                    WHERE IsDeleted = 0 AND Email IS NOT NULL');
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'IX_Clients_BranchId_Email')
                    DROP INDEX IX_Clients_BranchId_Email ON dbo.Clients;

                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'LastLoginAt')
                    ALTER TABLE dbo.Clients DROP COLUMN LastLoginAt;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'EmailVerificationFailedAttempts')
                    ALTER TABLE dbo.Clients DROP COLUMN EmailVerificationFailedAttempts;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'EmailVerificationLastSentAt')
                    ALTER TABLE dbo.Clients DROP COLUMN EmailVerificationLastSentAt;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'EmailVerificationCodeExpiresAt')
                    ALTER TABLE dbo.Clients DROP COLUMN EmailVerificationCodeExpiresAt;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'EmailVerificationCodeHash')
                    ALTER TABLE dbo.Clients DROP COLUMN EmailVerificationCodeHash;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'IsEmailVerified')
                    ALTER TABLE dbo.Clients DROP COLUMN IsEmailVerified;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'PasswordHash')
                    ALTER TABLE dbo.Clients DROP COLUMN PasswordHash;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'Email')
                    ALTER TABLE dbo.Clients DROP COLUMN Email;
            """);
        }
    }
}
