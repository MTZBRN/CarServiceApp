import React, { InputHTMLAttributes, useState, useRef, useEffect } from "react";
import { LucideIcon, ChevronDown, Check } from "lucide-react";

// --- STÍLUSOK ---
const wrapperStyle: React.CSSProperties = {
  marginBottom: "15px",
  width: "100%",
  position: "relative",
  boxSizing: "border-box", // FONTOS: A wrapper se lógjon ki
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  color: "#a1a1aa",
  marginBottom: "6px",
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const inputContainerStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  width: "100%",
  boxSizing: "border-box",
};

const baseFieldStyle: React.CSSProperties = {
  width: "100%",
  height: "40px",
  background: "#27272a", // Zinc-800
  border: "1px solid #3f3f46", // Zinc-700
  borderRadius: "6px",
  color: "white",
  fontSize: "0.9rem",
  paddingLeft: "12px",
  paddingRight: "12px",
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
  boxSizing: "border-box", // FONTOS: Ez javítja a "kilógást"! (Paddingot beleérti a szélességbe)
};

// --- INPUT KOMPONENS ---
interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: LucideIcon;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  icon: Icon,
  style,
  ...props
}) => {
  return (
    <div style={wrapperStyle}>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={inputContainerStyle}>
        {Icon && (
          <Icon
            size={16}
            style={{
              position: "absolute",
              left: "12px",
              color: "#71717a",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
        )}
        <input
          style={{
            ...baseFieldStyle,
            paddingLeft: Icon ? "38px" : "12px",
            ...style,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "#3b82f6";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "#3f3f46";
          }}
          {...props}
        />
      </div>
    </div>
  );
};

// --- CUSTOM SELECT (EGYEDI DROPDOWN) ---
interface CustomSelectProps {
  label?: string;
  icon?: LucideIcon;
  value: string | number;
  onChange: (e: { target: { value: string } }) => void;
  options: { value: string | number; label: string }[];
  placeholder?: string;
  required?: boolean;
}

export const SelectField: React.FC<CustomSelectProps> = ({
  label,
  icon: Icon,
  value,
  onChange,
  options,
  placeholder = "-- Válassz --",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (selectedValue: string | number) => {
    const syntheticEvent = { target: { value: String(selectedValue) } };
    onChange(syntheticEvent);
    setIsOpen(false);
  };

  const selectedOption = options.find(
    (opt) => String(opt.value) === String(value),
  );

  return (
    <div style={wrapperStyle} ref={containerRef}>
      {label && <label style={labelStyle}>{label}</label>}

      {/* TRIGGER */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...baseFieldStyle,
          paddingLeft: Icon ? "38px" : "12px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between", // Szöveg balra, nyíl jobbra
          borderColor: isOpen ? "#3b82f6" : "#3f3f46",
          position: "relative",
          overflow: "hidden", // Hogy ne lógjon ki semmi
        }}
      >
        {Icon && (
          <Icon
            size={16}
            style={{ position: "absolute", left: "12px", color: "#71717a" }}
          />
        )}

        {/* Szöveg kezelése, hogy ne nyomja szét a dobozt hosszú név esetén */}
        <span
          style={{
            color: selectedOption ? "white" : "#71717a",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1, // Kitölti a rendelkezésre álló helyet
            marginRight: "8px",
          }}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <ChevronDown
          size={16}
          color="#71717a"
          style={{
            flexShrink: 0,
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        />
      </div>

      {/* DROPDOWN LISTA */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0, // Pontosan a szülő szélességéhez igazodik
            marginTop: "6px",
            background: "#27272a",
            border: "1px solid #3f3f46",
            borderRadius: "6px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
            maxHeight: "250px",
            overflowY: "auto",
          }}
        >
          {options.length === 0 ? (
            <div
              style={{
                padding: "10px",
                color: "#71717a",
                textAlign: "center",
                fontSize: "0.9rem",
              }}
            >
              Nincs adat
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: isSelected
                      ? "rgba(59, 130, 246, 0.15)"
                      : "transparent",
                    color: isSelected ? "#60a5fa" : "#e4e4e7",
                    borderBottom: "1px solid #333",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.background = "#3f3f46";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {opt.label}
                  </span>
                  {isSelected && <Check size={14} style={{ flexShrink: 0 }} />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
