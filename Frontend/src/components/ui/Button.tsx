import React from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  type = "button",
  className = "",
  children,
  ...props
}) => (
  <button
    {...props}
    type={type}
    className={`ui-button ui-button-${variant} ${className}`.trim()}
  >
    {children}
  </button>
);

export default Button;
