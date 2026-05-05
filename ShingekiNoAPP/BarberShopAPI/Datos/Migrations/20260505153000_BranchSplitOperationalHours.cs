using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Datos.Migrations
{
    /// <inheritdoc />
    public partial class BranchSplitOperationalHours : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                SET ANSI_NULLS ON;
                SET QUOTED_IDENTIFIER ON;
            """);

            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'DayShiftEnabled')
                    ALTER TABLE dbo.Branches ADD DayShiftEnabled bit NOT NULL CONSTRAINT DF_Branches_DayShiftEnabled DEFAULT 0;
            """);

            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'DayOpeningHour')
                    ALTER TABLE dbo.Branches ADD DayOpeningHour int NOT NULL CONSTRAINT DF_Branches_DayOpeningHour DEFAULT 10;
            """);

            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'DayClosingHour')
                    ALTER TABLE dbo.Branches ADD DayClosingHour int NOT NULL CONSTRAINT DF_Branches_DayClosingHour DEFAULT 16;
            """);

            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'NightShiftEnabled')
                    ALTER TABLE dbo.Branches ADD NightShiftEnabled bit NOT NULL CONSTRAINT DF_Branches_NightShiftEnabled DEFAULT 0;
            """);

            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'NightOpeningHour')
                    ALTER TABLE dbo.Branches ADD NightOpeningHour int NOT NULL CONSTRAINT DF_Branches_NightOpeningHour DEFAULT 21;
            """);

            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'NightClosingHour')
                    ALTER TABLE dbo.Branches ADD NightClosingHour int NOT NULL CONSTRAINT DF_Branches_NightClosingHour DEFAULT 2;
            """);

            migrationBuilder.Sql("""
                UPDATE dbo.Branches
                SET
                    DayShiftEnabled = CASE WHEN OpeningHour < ClosingHour THEN 1 ELSE DayShiftEnabled END,
                    DayOpeningHour = CASE WHEN OpeningHour < ClosingHour THEN OpeningHour ELSE DayOpeningHour END,
                    DayClosingHour = CASE WHEN OpeningHour < ClosingHour THEN ClosingHour ELSE DayClosingHour END,
                    NightShiftEnabled = CASE WHEN OpeningHour >= ClosingHour THEN 1 ELSE NightShiftEnabled END,
                    NightOpeningHour = CASE WHEN OpeningHour >= ClosingHour THEN OpeningHour ELSE NightOpeningHour END,
                    NightClosingHour = CASE WHEN OpeningHour >= ClosingHour THEN ClosingHour ELSE NightClosingHour END
                WHERE OpeningHour BETWEEN 0 AND 23 AND ClosingHour BETWEEN 0 AND 23;
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'NightClosingHour')
                    ALTER TABLE dbo.Branches DROP COLUMN NightClosingHour;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'NightOpeningHour')
                    ALTER TABLE dbo.Branches DROP COLUMN NightOpeningHour;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'NightShiftEnabled')
                    ALTER TABLE dbo.Branches DROP COLUMN NightShiftEnabled;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'DayClosingHour')
                    ALTER TABLE dbo.Branches DROP COLUMN DayClosingHour;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'DayOpeningHour')
                    ALTER TABLE dbo.Branches DROP COLUMN DayOpeningHour;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Branches') AND name = 'DayShiftEnabled')
                    ALTER TABLE dbo.Branches DROP COLUMN DayShiftEnabled;
            """);
        }
    }
}
