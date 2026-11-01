using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarServiceShop.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditTrail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditEvents",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    TimestampUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ActorUserId = table.Column<int>(type: "INTEGER", nullable: true),
                    ActorName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    ActorRole = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    Action = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ResourceType = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    ResourceId = table.Column<int>(type: "INTEGER", nullable: true),
                    Outcome = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    Details = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: false),
                    TraceId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditEvents", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditEvents_ActorUserId_TimestampUtc",
                table: "AuditEvents",
                columns: new[] { "ActorUserId", "TimestampUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditEvents_ResourceType_ResourceId_TimestampUtc",
                table: "AuditEvents",
                columns: new[] { "ResourceType", "ResourceId", "TimestampUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditEvents_TimestampUtc_Id",
                table: "AuditEvents",
                columns: new[] { "TimestampUtc", "Id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditEvents");
        }
    }
}
