using Microsoft.EntityFrameworkCore.Migrations;
namespace CarServiceShop.Migrations;
public partial class IntegrityGuards : Migration {
    protected override void Up(MigrationBuilder m) {
        // Abort before changing accounts when existing identifiers collide. Never merge/delete users.
        m.Sql("CREATE TEMP TABLE _LoginCheck (N INTEGER);");
        m.Sql("CREATE TEMP TRIGGER _LoginCheckAbort BEFORE INSERT ON _LoginCheck WHEN NEW.N > 0 BEGIN SELECT RAISE(ABORT, 'Duplicate normalized usernames: resolve accounts before migrating'); END;");
        m.Sql("INSERT INTO _LoginCheck SELECT count(*) FROM (SELECT upper(trim(Email)) FROM Users GROUP BY upper(trim(Email)) HAVING count(*) > 1);");
        m.Sql("DROP TABLE _LoginCheck;");
        m.AddColumn<string>(name:"NormalizedLogin",table:"Users",type:"TEXT",nullable:false,computedColumnSql:"upper(trim(Email))",stored:false);
        m.CreateIndex(name:"IX_Users_NormalizedLogin",table:"Users",column:"NormalizedLogin",unique:true);
        foreach(var table in new[]{"ServiceJobs","Appointments","Parts","GlobalSettings"})
            m.AddColumn<string>(name:"Version",table:table,type:"TEXT",nullable:false,defaultValue:"initial");
        m.Sql("CREATE TRIGGER Users_KeepLastAdmin BEFORE DELETE ON Users WHEN OLD.Role = 'admin' AND (SELECT count(*) FROM Users WHERE Role = 'admin') <= 1 BEGIN SELECT RAISE(ABORT, 'last_admin'); END;");
        m.Sql("CREATE TRIGGER Customers_KeepVehicles BEFORE DELETE ON Customers WHEN EXISTS(SELECT 1 FROM Vehicles WHERE CustomerId=OLD.Id) BEGIN SELECT RAISE(ABORT, 'protected_history'); END;");
        m.Sql("CREATE TRIGGER Vehicles_KeepHistory BEFORE DELETE ON Vehicles WHEN EXISTS(SELECT 1 FROM ServiceJobs WHERE VehicleId=OLD.Id) OR EXISTS(SELECT 1 FROM Appointments WHERE VehicleId=OLD.Id) BEGIN SELECT RAISE(ABORT, 'protected_history'); END;");
    }
    protected override void Down(MigrationBuilder m) {
        m.Sql("DROP TRIGGER IF EXISTS Users_KeepLastAdmin;");
        m.Sql("DROP TRIGGER IF EXISTS Customers_KeepVehicles;");
        m.Sql("DROP TRIGGER IF EXISTS Vehicles_KeepHistory;");
        m.DropIndex(name:"IX_Users_NormalizedLogin",table:"Users");
        m.DropColumn(name:"NormalizedLogin",table:"Users");
        foreach(var table in new[]{"ServiceJobs","Appointments","Parts","GlobalSettings"}) m.DropColumn(name:"Version",table:table);
    }
}
