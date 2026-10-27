import React from "react";

type BadgeTone = "info" | "success" | "warning" | "danger" | "neutral";

interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
}

const Badge: React.FC<BadgeProps> = ({ children, tone = "neutral" }) => (
  <span className={`ui-badge ui-badge-${tone}`}>{children}</span>
);

export default Badge;
