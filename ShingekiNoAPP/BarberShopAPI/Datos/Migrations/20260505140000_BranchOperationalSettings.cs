using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Datos.Migrations
{
    /// <inheritdoc />
    public partial class BranchOperationalSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'OpeningHour')
                    ALTER TABLE dbo.Branches ADD OpeningHour int NOT NULL CONSTRAINT DF_Branches_OpeningHour DEFAULT 18;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'ClosingHour')
                    ALTER TABLE dbo.Branches ADD ClosingHour int NOT NULL CONSTRAINT DF_Branches_ClosingHour DEFAULT 2;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'TimeZoneId')
                    ALTER TABLE dbo.Branches ADD TimeZoneId nvarchar(80) NOT NULL CONSTRAINT DF_Branches_TimeZoneId DEFAULT 'America/Montevideo';
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'TimeZoneId')
                    ALTER TABLE dbo.Branches DROP COLUMN TimeZoneId;

                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'ClosingHour')
                    ALTER TABLE dbo.Branches DROP COLUMN ClosingHour;

                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'OpeningHour')
                    ALTER TABLE dbo.Branches DROP COLUMN OpeningHour;
            """);
        }
    }
}
