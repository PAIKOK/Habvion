import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";
import { Icon } from "./Icons";

/** A password box with a Show/Hide button. The button is a real button, so it works from the keyboard. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(function PasswordInput(props, ref) {
  const [shown, setShown] = useState(false), generatedId = useId(), id = props.id ?? generatedId;
  return (
    <span className="password-input">
      <input {...props} id={id} ref={ref} type={shown ? "text" : "password"} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setShown((s) => !s)}
        aria-pressed={shown}
        aria-controls={id}
        aria-label={shown ? "Hide password" : "Show password"}
        title={shown ? "Hide password" : "Show password"}
      >
        <Icon name={shown ? "eye-off" : "eye"} size={18} />
      </button>
    </span>
  );
});
