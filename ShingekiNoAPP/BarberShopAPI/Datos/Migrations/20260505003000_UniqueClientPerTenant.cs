using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Datos.Migrations
{
    /// <inheritdoc />
    public partial class UniqueClientPerTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ;WITH ClientWinners AS
                (
                    SELECT
                        Id,
                        MIN(Id) OVER (PARTITION BY BranchId, Phone) AS KeepId
                    FROM dbo.Clients
                    WHERE IsDeleted = 0 AND Phone > 0
                )
                UPDATE o
                SET ClientId = w.KeepId
                FROM dbo.Orders o
                INNER JOIN ClientWinners w ON o.ClientId = w.Id
                WHERE w.Id <> w.KeepId;

                ;WITH ClientWinners AS
                (
                    SELECT
                        Id,
                        MIN(Id) OVER (PARTITION BY BranchId, Phone) AS KeepId
                    FROM dbo.Clients
                    WHERE IsDeleted = 0 AND Phone > 0
                )
                UPDATE a
                SET ClientId = w.KeepId
                FROM dbo.ClientAddresses a
                INNER JOIN ClientWinners w ON a.ClientId = w.Id
                WHERE w.Id <> w.KeepId;

                ;WITH ClientWinners AS
                (
                    SELECT
                        Id,
                        MIN(Id) OVER (PARTITION BY BranchId, Phone) AS KeepId
                    FROM dbo.Clients
                    WHERE IsDeleted = 0 AND Phone > 0
                )
                UPDATE c
                SET IsDeleted = 1
                FROM dbo.Clients c
                INNER JOIN ClientWinners w ON c.Id = w.Id
                WHERE w.Id <> w.KeepId;

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'IX_Clients_BranchId_Phone')
                    CREATE UNIQUE INDEX IX_Clients_BranchId_Phone
                    ON dbo.Clients(BranchId, Phone)
                    WHERE IsDeleted = 0 AND Phone > 0;
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Clients') AND name = 'IX_Clients_BranchId_Phone')
                    DROP INDEX IX_Clients_BranchId_Phone ON dbo.Clients;
            """);
        }
    }
}
