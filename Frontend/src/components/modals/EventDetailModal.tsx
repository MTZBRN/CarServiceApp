import DialogSurface from '../ui/DialogSurface';
import React from "react";
import { CalendarEvent } from "../../types";
import {
  X,
  Trash2,
  Wrench,
  Calendar,
  Clock,
  FileText,
  AlignLeft,
} from "lucide-react";
import { format } from "date-fns";
import { hu } from "date-fns/locale";

interface Props {
  event: CalendarEvent | null;
  onClose: () => void;
  onDelete: (id: number) => void;
  onOpenWorksheet: (id: number) => void;
}

const EventDetailModal: React.FC<Props> = ({
  event,
  onClose,
  onDelete,
  onOpenWorksheet,
}) => {
  if (!event) return null;

  // --- LOGIKA AZ EGÉSZ NAPOS ESEMÉNYEK KEZELÉSÉRE ---
  const start = new Date(event.start);
  const end = new Date(event.end);
  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  const isAllDay = durationHours >= 20; // 20 óra felett egész naposnak vesszük

  // Dátum javítása (Timezone fix)
  const displayDate =
    isAllDay && start.getHours() === 23
      ? new Date(start.getTime() + 60 * 60 * 1000)
      : start;

  const formattedDate = format(displayDate, "yyyy. MM. dd.", {
    locale: hu,
  });
  const timeRange = `${format(start, "HH:mm")} - ${format(end, "HH:mm")}`;
  const isMot = event.type === "mot";

  // --- TÖRLÉS KEZELÉSE ---
  const handleDelete = () => {
    // 1. Megkérdezzük a felhasználót
    if (
      window.confirm(
        "Biztosan törölni szeretnéd ezt az időpontot? A művelet nem visszavonható.",
      )
    ) {
      // 2. Ha igent mondott, törlünk
      onDelete(Number(event.id));
      // 3. És azonnal bezárjuk az ablakot
      onClose();
    }
  };

  return (
    <DialogSurface title="Időpont részletei" onClose={onClose} className="modal-overlay modal-on-top">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "500px",
          padding: 0,
          overflow: "hidden",
          borderRadius: "12px",
        }}
      >
        {/* FEJLÉC SZÍNES SÁVVAL */}
        <div
          style={{
            background: isMot ? "#ef4444" : "#3b82f6",
            padding: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "15px",
              alignItems: "center",
              color: "white",
            }}
          >
            <div
              style={{
                background: "rgba(0,0,0,0.2)",
                padding: "12px",
                borderRadius: "12px",
              }}
            >
              {isMot ? <FileText size={32} /> : <Wrench size={32} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.3rem", fontWeight: "bold" }}>
                {event.title}
              </h3>
              <span
                style={{ fontSize: "0.9rem", opacity: 0.9, fontWeight: 500 }}
              >
                {isMot ? "Műszaki Vizsga" : "Szerviz Időpont"}
              </span>
            </div>
          </div>
          <button aria-label="Bezárás"
            onClick={onClose}
            style={{
              background: "rgba(0,0,0,0.2)",
              border: "none",
              color: "white",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* TARTALOM */}
        <div style={{ padding: "25px", background: "#18181b" }}>
          {/* 1. DÁTUM SZEKCIÓ */}
          <div
            style={{
              background: "#27272a",
              padding: "15px",
              borderRadius: "8px",
              marginBottom: "20px",
              border: "1px solid #3f3f46",
              display: "flex",
              alignItems: "center",
              gap: "15px",
            }}
          >
            <div
              style={{
                background: "#3f3f46",
                padding: "10px",
                borderRadius: "8px",
              }}
            >
              <Calendar size={24} color="#e4e4e7" />
            </div>
            <div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "1.2rem",
                  color: "#e4e4e7",
                }}
              >
                {formattedDate}
              </div>
              <div
                style={{
                  color: "#a1a1aa",
                  fontSize: "0.9rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Clock size={14} /> {isAllDay ? "Egész napos" : timeRange}
              </div>
            </div>
          </div>

          {/* 2. MEGJEGYZÉS / LEÍRÁS (LÁTVÁNYOSABB DOBOZ) */}
          {event.desc ? (
            <div style={{ marginBottom: "25px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: "8px",
                  color: "#a1a1aa",
                }}
              >
                <AlignLeft size={16} />
                <span
                  style={{
                    fontSize: "0.85rem",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  Megjegyzés / Leírás
                </span>
              </div>
              <div
                style={{
                  background: "#222",
                  padding: "15px",
                  borderRadius: "8px",
                  border: "1px dashed #444",
                  color: "#e4e4e7",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap", // 👈 Ez nagyon fontos! Így megmaradnak a sorterések
                  fontSize: "0.95rem",
                }}
              >
                {event.desc}
              </div>
            </div>
          ) : (
            <div
              style={{
                marginBottom: "25px",
                fontStyle: "italic",
                color: "#555",
                fontSize: "0.9rem",
                textAlign: "center",
              }}
            >
              Nincs megjegyzés fűzve az eseményhez.
            </div>
          )}

          {/* GOMBOK */}
          {!isMot && <div style={{ display: "flex", gap: "15px", marginTop: "30px" }}>
            <button
              onClick={() => onOpenWorksheet(Number(event.id))}
              className="btn-add"
              style={{
                flex: 1,
                height: "45px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "10px",
                background: "#eab308",
                color: "black",
                fontWeight: "bold",
                fontSize: "1rem",
                boxShadow: "0 4px 10px rgba(234, 179, 8, 0.2)",
              }}
            >
              <Wrench size={20} /> Munkalap Megnyitása
            </button>

            <button
              onClick={handleDelete} // 👈 Most már a saját függvényünket hívjuk!
              style={{
                width: "50px",
                height: "45px",
                background: "#27272a",
                border: "1px solid #ef4444",
                color: "#ef4444",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
              title="Törlés"
              onMouseOver={(e) =>
                (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")
              }
              onMouseOut={(e) => (e.currentTarget.style.background = "#27272a")}
            >
              <Trash2 size={22} />
            </button>
          </div>}
        </div>
      </div>
    </DialogSurface>
  );
};

export default EventDetailModal;
