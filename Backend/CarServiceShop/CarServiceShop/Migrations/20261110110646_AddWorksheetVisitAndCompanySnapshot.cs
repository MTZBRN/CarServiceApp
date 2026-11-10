using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarServiceShop.Migrations
{
    /// <inheritdoc />
    public partial class AddWorksheetVisitAndCompanySnapshot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CompanyHistory",
                table: "ServiceJobs",
                type: "TEXT",
                nullable: false,
                defaultValue: "HistoricalUnavailable");

            migrationBuilder.AddColumn<string>(
                name: "CompanySnapshot",
                table: "ServiceJobs",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OdometerKm",
                table: "ServiceJobs",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PowertrainCode",
                table: "ServiceJobs",
                type: "TEXT",
                nullable: true);

            // Only an audited open creation without a subsequent completion qualifies.
            migrationBuilder.Sql("""
                UPDATE ServiceJobs SET CompanyHistory = 'Pending'
                WHERE IsCompleted = 0 AND Id IN (
                    SELECT ResourceId FROM AuditEvents
                    WHERE ResourceType = 'Worksheet' AND Outcome = 'Success' AND ResourceId IS NOT NULL
                    GROUP BY ResourceId
                    HAVING count(*) FILTER (WHERE Action = 'Worksheet.Created') = 1
                       AND count(*) FILTER (WHERE Action = 'Worksheet.Created'
                           AND json_type(CASE WHEN json_valid(Details) THEN Details END,
                                         '$.changes.IsCompleted.after') = 'false') = 1
                       AND count(*) FILTER (WHERE Action IN ('Worksheet.Completed', 'Worksheet.CompletedCorrected',
                                                           'Worksheet.Reopened', 'Worksheet.Deleted')) = 0
                );
                """);

            migrationBuilder.Sql("""
                CREATE TRIGGER FreezeWorksheetCompany BEFORE UPDATE OF CompanySnapshot, CompanyHistory ON ServiceJobs
                WHEN OLD.CompanyHistory != 'Pending' AND
                    (NEW.CompanySnapshot IS NOT OLD.CompanySnapshot OR NEW.CompanyHistory IS NOT OLD.CompanyHistory)
                BEGIN SELECT RAISE(ABORT, 'Worksheet company history is immutable'); END;
                """);
            foreach (var operation in new[] { "INSERT", "UPDATE" })
            {
                var firstCapture = operation == "INSERT" ? "1" : "OLD.CompanyHistory != 'Captured'";
                migrationBuilder.Sql($"""
                    CREATE TRIGGER ValidateWorksheetCompany{operation} BEFORE {operation} ON ServiceJobs
                    WHEN NEW.CompanyHistory NOT IN ('Pending', 'Captured', 'HistoricalUnavailable')
                      OR (NEW.CompanyHistory = 'Captured') != (NEW.CompanySnapshot IS NOT NULL)
                      OR (NEW.CompanyHistory = 'Pending' AND NEW.IsCompleted != 0)
                      OR (NEW.CompanyHistory = 'Captured' AND ({firstCapture}) AND NEW.IsCompleted != 1)
                    BEGIN SELECT RAISE(ABORT, 'Invalid worksheet company history'); END;
                    """);
            }
            // CASE evaluates json_type/json_each only after json_valid succeeds.
            // Validate on capture only; the freeze trigger protects all later updates.
            foreach (var operation in new[] { "INSERT", "UPDATE OF CompanyHistory, CompanySnapshot" })
            {
                var suffix = operation == "INSERT" ? "Insert" : "Update";
                var firstCapture = operation == "INSERT" ? "1" : "OLD.CompanyHistory = 'Pending'";
                migrationBuilder.Sql($"""
                    CREATE TRIGGER ValidateSnapshot{suffix} BEFORE {operation} ON ServiceJobs
                    WHEN NEW.CompanyHistory = 'Captured' AND ({firstCapture}) AND CASE
                        WHEN json_valid(NEW.CompanySnapshot) IS NOT 1 THEN 1
                        WHEN json_type(NEW.CompanySnapshot) IS NOT 'object' THEN 1
                        ELSE (
                            SELECT count(*) != 7 OR count(DISTINCT key) != 7 OR min(type = 'text') != 1
                            FROM json_each(NEW.CompanySnapshot)
                            WHERE key IN ('CompanyName','Address','Phone','Email','TaxNumber','SettingsVersion','CapturedAtUtc')
                        ) OR trim(json_extract(NEW.CompanySnapshot,'$.CompanyName')) = ''
                          OR trim(json_extract(NEW.CompanySnapshot,'$.SettingsVersion')) = ''
                          OR (SELECT
                                substr(stamp, -1) != 'Z'
                                OR strftime('%Y-%m-%dT%H:%M:%S', substr(stamp,1,19), '+0 seconds') IS NOT substr(stamp,1,19)
                                OR substr(stamp,1,4) = '0000'
                                OR NOT (length(stamp) = 20 OR
                                    (length(stamp) BETWEEN 22 AND 28 AND substr(stamp,20,1) = '.'
                                     AND substr(stamp,21,length(stamp)-21) NOT GLOB '*[^0-9]*'))
                              FROM (SELECT json_extract(NEW.CompanySnapshot,'$.CapturedAtUtc') AS stamp))
                    END
                    BEGIN SELECT RAISE(ABORT, 'Invalid worksheet company snapshot'); END;
                    """);
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException("Restore a verified pre-migration backup to a separate database for rollback.");
        }
    }
}
