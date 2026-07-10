import { useRef } from "react";

export default function LiquidGlass({ as: Tag = "div", className = "", children, ...props }) {
  const ref = useRef(null);

  function handleMouseMove(e) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--mx", `${x}%`);
    el.style.setProperty("--my", `${y}%`);
  }

  function handleMouseLeave() {
    ref.current?.style.setProperty("--mx", "30%");
    ref.current?.style.setProperty("--my", "20%");
  }

  return (
    <Tag
      ref={ref}
      className={`liquid-glass ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </Tag>
  );
}