import { forwardRef, useState } from "react";

const FormField = forwardRef(function FormField(
  { label, error, type = "text", id, ...props },
  ref
) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && show ? "text" : type;

  return (
    <div className="mb-5 text-left">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-text mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={inputType}
          className="lux-input w-full py-3.5 px-4 rounded-xl text-base text-text placeholder:text-placeholder outline-none"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-text text-sm font-medium transition-colors"
            tabIndex={-1}
          >
            {show ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {error && <p className="text-sm font-medium mt-1.5" style={{ color: "var(--np-crimson)" }}>{error}</p>}
    </div>
  );
});

export default FormField;