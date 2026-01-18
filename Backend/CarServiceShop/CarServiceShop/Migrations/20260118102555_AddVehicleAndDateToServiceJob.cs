using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarServiceShop.Migrations
{
    /// <inheritdoc />
    public partial class AddVehicleAndDateToServiceJob : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Appointments_Vehicles_VehicleId",
                table: "Appointments");

            migrationBuilder.DropForeignKey(
                name: "FK_ServiceJobs_Vehicles_VehicleId",
                table: "ServiceJobs");

            migrationBuilder.AlterColumn<int>(
                name: "VehicleId",
                table: "ServiceJobs",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "INTEGER",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "AppointmentId",
                table: "ServiceJobs",
                type: "INTEGER",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "INTEGER");

            migrationBuilder.AddColumn<DateTime>(
                name: "Date",
                table: "ServiceJobs",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AlterColumn<int>(
                name: "VehicleId",
                table: "Appointments",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "INTEGER",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Appointments_Vehicles_VehicleId",
                table: "Appointments",
                column: "VehicleId",
                principalTable: "Vehicles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceJobs_Vehicles_VehicleId",
                table: "ServiceJobs",
                column: "VehicleId",
                principalTable: "Vehicles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Appointments_Vehicles_VehicleId",
                table: "Appointments");

            migrationBuilder.DropForeignKey(
                name: "FK_ServiceJobs_Vehicles_VehicleId",
                table: "ServiceJobs");

            migrationBuilder.DropColumn(
                name: "Date",
                table: "ServiceJobs");

            migrationBuilder.AlterColumn<int>(
                name: "VehicleId",
                table: "ServiceJobs",
                type: "INTEGER",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "INTEGER");

            migrationBuilder.AlterColumn<int>(
                name: "AppointmentId",
                table: "ServiceJobs",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "INTEGER",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "VehicleId",
                table: "Appointments",
                type: "INTEGER",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "INTEGER");

            migrationBuilder.AddForeignKey(
                name: "FK_Appointments_Vehicles_VehicleId",
                table: "Appointments",
                column: "VehicleId",
                principalTable: "Vehicles",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceJobs_Vehicles_VehicleId",
                table: "ServiceJobs",
                column: "VehicleId",
                principalTable: "Vehicles",
                principalColumn: "Id");
        }
    }
}
