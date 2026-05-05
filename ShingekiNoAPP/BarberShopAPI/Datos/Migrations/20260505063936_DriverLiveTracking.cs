using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Datos.Migrations
{
    /// <inheritdoc />
    public partial class DriverLiveTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "LastDriverAccuracyMeters",
                table: "Orders",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "LastDriverHeadingDegrees",
                table: "Orders",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "LastDriverLatitude",
                table: "Orders",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastDriverLocationAtUtc",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "LastDriverLongitude",
                table: "Orders",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "LastDriverSpeedMetersPerSecond",
                table: "Orders",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "LastDriverUserId",
                table: "Orders",
                type: "bigint",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastDriverAccuracyMeters",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "LastDriverHeadingDegrees",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "LastDriverLatitude",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "LastDriverLocationAtUtc",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "LastDriverLongitude",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "LastDriverSpeedMetersPerSecond",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "LastDriverUserId",
                table: "Orders");
        }
    }
}
