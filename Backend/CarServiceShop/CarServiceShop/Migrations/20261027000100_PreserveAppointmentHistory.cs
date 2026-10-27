using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using CarServiceShop.Data;
namespace CarServiceShop.Migrations;
[DbContext(typeof(ApplicationDbContext))]
[Migration("20261027000100_PreserveAppointmentHistory")]
public partial class PreserveAppointmentHistory : Migration
{
    protected override void Up(MigrationBuilder m) {
        m.DropForeignKey("FK_ServiceJobs_Appointments_AppointmentId", "ServiceJobs");
        m.AddForeignKey("FK_ServiceJobs_Appointments_AppointmentId", "ServiceJobs", "AppointmentId", "Appointments", principalColumn: "Id", onDelete: ReferentialAction.SetNull);
    }
    protected override void Down(MigrationBuilder m) {
        m.DropForeignKey("FK_ServiceJobs_Appointments_AppointmentId", "ServiceJobs");
        m.AddForeignKey("FK_ServiceJobs_Appointments_AppointmentId", "ServiceJobs", "AppointmentId", "Appointments", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
    }
}