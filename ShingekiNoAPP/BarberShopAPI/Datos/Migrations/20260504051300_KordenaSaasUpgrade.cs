using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Datos.Migrations
{
    /// <inheritdoc />
    public partial class KordenaSaasUpgrade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Ingredients') AND name = 'ImageUrl')
                    ALTER TABLE dbo.Ingredients ADD ImageUrl nvarchar(max) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'Slug')
                    ALTER TABLE dbo.Branches ADD Slug nvarchar(80) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'TenantFolder')
                    ALTER TABLE dbo.Branches ADD TenantFolder nvarchar(120) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'BrandName')
                    ALTER TABLE dbo.Branches ADD BrandName nvarchar(120) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'PublicDescription')
                    ALTER TABLE dbo.Branches ADD PublicDescription nvarchar(500) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'LogoUrl')
                    ALTER TABLE dbo.Branches ADD LogoUrl nvarchar(500) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'PrimaryColor')
                    ALTER TABLE dbo.Branches ADD PrimaryColor nvarchar(24) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'SecondaryColor')
                    ALTER TABLE dbo.Branches ADD SecondaryColor nvarchar(24) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'AccentColor')
                    ALTER TABLE dbo.Branches ADD AccentColor nvarchar(24) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'BillingEmail')
                    ALTER TABLE dbo.Branches ADD BillingEmail nvarchar(160) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'MembershipPlan')
                    ALTER TABLE dbo.Branches ADD MembershipPlan nvarchar(32) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'MembershipStatus')
                    ALTER TABLE dbo.Branches ADD MembershipStatus nvarchar(32) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'TrialEndsAt')
                    ALTER TABLE dbo.Branches ADD TrialEndsAt datetime2 NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'PublicOrderingEnabled')
                    ALTER TABLE dbo.Branches ADD PublicOrderingEnabled bit NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'MonthlyOrderLimit')
                    ALTER TABLE dbo.Branches ADD MonthlyOrderLimit int NULL;

                UPDATE dbo.Branches
                SET
                    Slug = COALESCE(NULLIF(LTRIM(RTRIM(Slug)), ''), CONCAT('tenant-', Id)),
                    TenantFolder = COALESCE(NULLIF(LTRIM(RTRIM(TenantFolder)), ''), COALESCE(NULLIF(LTRIM(RTRIM(Slug)), ''), CONCAT('tenant-', Id))),
                    BrandName = COALESCE(NULLIF(LTRIM(RTRIM(BrandName)), ''), Name),
                    PrimaryColor = COALESCE(NULLIF(LTRIM(RTRIM(PrimaryColor)), ''), '#111827'),
                    SecondaryColor = COALESCE(NULLIF(LTRIM(RTRIM(SecondaryColor)), ''), '#f59e0b'),
                    AccentColor = COALESCE(NULLIF(LTRIM(RTRIM(AccentColor)), ''), '#10b981'),
                    MembershipPlan = COALESCE(NULLIF(LTRIM(RTRIM(MembershipPlan)), ''), 'Pro'),
                    MembershipStatus = COALESCE(NULLIF(LTRIM(RTRIM(MembershipStatus)), ''), 'Active'),
                    PublicOrderingEnabled = COALESCE(PublicOrderingEnabled, 1),
                    MonthlyOrderLimit = COALESCE(MonthlyOrderLimit, 0),
                    PublicDescription = COALESCE(PublicDescription, 'Pedido online con seguimiento en vivo.')
                WHERE IsDeleted = 0;
            """);

            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'Slug' AND is_nullable = 1)
                    ALTER TABLE dbo.Branches ALTER COLUMN Slug nvarchar(80) NOT NULL;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'TenantFolder' AND is_nullable = 1)
                    ALTER TABLE dbo.Branches ALTER COLUMN TenantFolder nvarchar(120) NOT NULL;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'PrimaryColor' AND is_nullable = 1)
                    ALTER TABLE dbo.Branches ALTER COLUMN PrimaryColor nvarchar(24) NOT NULL;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'SecondaryColor' AND is_nullable = 1)
                    ALTER TABLE dbo.Branches ALTER COLUMN SecondaryColor nvarchar(24) NOT NULL;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'AccentColor' AND is_nullable = 1)
                    ALTER TABLE dbo.Branches ALTER COLUMN AccentColor nvarchar(24) NOT NULL;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'PublicOrderingEnabled' AND is_nullable = 1)
                    ALTER TABLE dbo.Branches ALTER COLUMN PublicOrderingEnabled bit NOT NULL;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'MonthlyOrderLimit' AND is_nullable = 1)
                    ALTER TABLE dbo.Branches ALTER COLUMN MonthlyOrderLimit int NOT NULL;
            """);

            migrationBuilder.Sql("""
                SET QUOTED_IDENTIFIER ON;
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'IX_Branches_Slug')
                    CREATE UNIQUE INDEX IX_Branches_Slug ON dbo.Branches(Slug) WHERE IsDeleted = 0;
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'IX_Branches_TenantFolder')
                    CREATE UNIQUE INDEX IX_Branches_TenantFolder ON dbo.Branches(TenantFolder) WHERE IsDeleted = 0;
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'IX_Branches_Slug')
                    DROP INDEX IX_Branches_Slug ON dbo.Branches;
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'IX_Branches_TenantFolder')
                    DROP INDEX IX_Branches_TenantFolder ON dbo.Branches;

                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'AccentColor')
                    ALTER TABLE dbo.Branches DROP COLUMN AccentColor;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'BillingEmail')
                    ALTER TABLE dbo.Branches DROP COLUMN BillingEmail;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'BrandName')
                    ALTER TABLE dbo.Branches DROP COLUMN BrandName;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'LogoUrl')
                    ALTER TABLE dbo.Branches DROP COLUMN LogoUrl;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'MembershipPlan')
                    ALTER TABLE dbo.Branches DROP COLUMN MembershipPlan;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'MembershipStatus')
                    ALTER TABLE dbo.Branches DROP COLUMN MembershipStatus;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'MonthlyOrderLimit')
                    ALTER TABLE dbo.Branches DROP COLUMN MonthlyOrderLimit;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'PrimaryColor')
                    ALTER TABLE dbo.Branches DROP COLUMN PrimaryColor;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'PublicDescription')
                    ALTER TABLE dbo.Branches DROP COLUMN PublicDescription;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'PublicOrderingEnabled')
                    ALTER TABLE dbo.Branches DROP COLUMN PublicOrderingEnabled;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'SecondaryColor')
                    ALTER TABLE dbo.Branches DROP COLUMN SecondaryColor;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'Slug')
                    ALTER TABLE dbo.Branches DROP COLUMN Slug;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'TenantFolder')
                    ALTER TABLE dbo.Branches DROP COLUMN TenantFolder;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'TrialEndsAt')
                    ALTER TABLE dbo.Branches DROP COLUMN TrialEndsAt;
            """);
        }
    }
}
