using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarServiceShop.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceAndParts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ServiceJobs_Vehicles_VehicleId",
                table: "ServiceJobs");

            migrationBuilder.DropIndex(
                name: "IX_Vehicles_LicensePlate",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "JobDate",
                table: "ServiceJobs");

            migrationBuilder.DropColumn(
                name: "Name",
                table: "JobParts");

            migrationBuilder.DropColumn(
                name: "PartNumber",
                table: "JobParts");

            migrationBuilder.DropColumn(
                name: "Price",
                table: "JobParts");

            migrationBuilder.RenameColumn(
                name: "Mileage",
                table: "ServiceJobs",
                newName: "LaborCost");

            migrationBuilder.RenameColumn(
                name: "Unit",
                table: "JobParts",
                newName: "PartName");

            migrationBuilder.AlterColumn<int>(
                name: "VehicleId",
                table: "ServiceJobs",
                type: "INTEGER",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "INTEGER");

            migrationBuilder.AddColumn<int>(
                name: "AppointmentId",
                table: "ServiceJobs",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsCompleted",
                table: "ServiceJobs",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AlterColumn<int>(
                name: "Quantity",
                table: "JobParts",
                type: "INTEGER",
                nullable: false,
                oldClrType: typeof(double),
                oldType: "REAL");

            migrationBuilder.AddColumn<int>(
                name: "UnitPrice",
                table: "JobParts",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceJobs_AppointmentId",
                table: "ServiceJobs",
                column: "AppointmentId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceJobs_Appointments_AppointmentId",
                table: "ServiceJobs",
                column: "AppointmentId",
                principalTable: "Appointments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceJobs_Vehicles_VehicleId",
                table: "ServiceJobs",
                column: "VehicleId",
                principalTable: "Vehicles",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ServiceJobs_Appointments_AppointmentId",
                table: "ServiceJobs");

            migrationBuilder.DropForeignKey(
                name: "FK_ServiceJobs_Vehicles_VehicleId",
                table: "ServiceJobs");

            migrationBuilder.DropIndex(
                name: "IX_ServiceJobs_AppointmentId",
                table: "ServiceJobs");

            migrationBuilder.DropColumn(
                name: "AppointmentId",
                table: "ServiceJobs");

            migrationBuilder.DropColumn(
                name: "IsCompleted",
                table: "ServiceJobs");

            migrationBuilder.DropColumn(
                name: "UnitPrice",
                table: "JobParts");

            migrationBuilder.RenameColumn(
                name: "LaborCost",
                table: "ServiceJobs",
                newName: "Mileage");

            migrationBuilder.RenameColumn(
                name: "PartName",
                table: "JobParts",
                newName: "Unit");

            migrationBuilder.AlterColumn<int>(
                name: "VehicleId",
                table: "ServiceJobs",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "INTEGER",
                oldNullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "JobDate",
                table: "ServiceJobs",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AlterColumn<double>(
                name: "Quantity",
                table: "JobParts",
                type: "REAL",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "INTEGER");

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "JobParts",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PartNumber",
                table: "JobParts",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "Price",
                table: "JobParts",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateIndex(
                name: "IX_Vehicles_LicensePlate",
                table: "Vehicles",
                column: "LicensePlate",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceJobs_Vehicles_VehicleId",
                table: "ServiceJobs",
                column: "VehicleId",
                principalTable: "Vehicles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
