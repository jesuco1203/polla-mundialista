"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type PasswordFieldProps = {
  name: string;
  placeholder: string;
};

export function PasswordField({ name, placeholder }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="password-field">
      <input
        name={name}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        required
        minLength={4}
      />
      <button
        aria-label={visible ? "Ocultar contrasena" : "Ver contrasena"}
        type="button"
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  );
}
