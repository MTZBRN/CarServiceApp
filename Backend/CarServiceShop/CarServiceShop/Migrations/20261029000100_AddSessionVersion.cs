using Microsoft.EntityFrameworkCore.Migrations;
namespace CarServiceShop.Migrations;
public partial class AddSessionVersion : Migration {
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.AddColumn<string>(name: "SessionVersion", table: "Users", type: "TEXT", nullable: false, defaultValue: "initial");
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropColumn(name: "SessionVersion", table: "Users");
}
