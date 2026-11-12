import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import "./Checkbox.css";
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode };
const Checkbox = forwardRef<HTMLInputElement, Props>(function Checkbox({ label, id, className = "", ...props }, ref) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return <label className={`ds-checkbox ${className}`}>
    <input {...props} ref={ref} id={inputId} type="checkbox" /><span>{label}</span>
  </label>;
});
export default Checkbox;
