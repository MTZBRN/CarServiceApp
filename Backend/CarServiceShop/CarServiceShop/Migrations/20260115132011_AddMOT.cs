using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarServiceShop.Migrations
{
    /// <inheritdoc />
    public partial class AddMOT : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "MOTExpiry",
                table: "Vehicles",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MOTExpiry",
                table: "Vehicles");
        }
    }
}
