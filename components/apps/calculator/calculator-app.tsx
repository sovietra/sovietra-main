"use client";

import { useState, useEffect, useCallback } from "react";
import { WindowControls } from "@/components/window-controls";
import { useWindowNavBehavior } from "@/lib/use-window-nav-behavior";
import { cn } from "@/lib/utils";

type Operator = "+" | "-" | "×" | "÷" | null;

interface CalcState {
  display: string;
  prevValue: number | null;
  operator: Operator;
  waitingForOperand: boolean;
  justEvaluated: boolean;
}

const INITIAL_STATE: CalcState = {
  display: "0",
  prevValue: null,
  operator: null,
  waitingForOperand: false,
  justEvaluated: false,
};

function calculate(a: number, op: Operator, b: number): number {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "×": return a * b;
    case "÷": return b !== 0 ? a / b : 0;
    default: return b;
  }
}

function formatDisplay(value: string): string {
  const num = parseFloat(value);
  if (!isFinite(num)) return "Error";
  // Scientific notation for very large/small numbers
  if (Math.abs(num) >= 1e10 || (Math.abs(num) < 1e-6 && num !== 0)) {
    return num.toExponential(6).replace(/\.?0+e/, "e");
  }
  // Limit decimal digits
  const str = parseFloat(num.toPrecision(10)).toString();
  return str;
}

function getFontSize(display: string): string {
  const len = display.length;
  if (len <= 6) return "text-[64px]";
  if (len <= 9) return "text-[48px]";
  if (len <= 12) return "text-[36px]";
  return "text-[28px]";
}

interface ButtonProps {
  label: string;
  onClick: () => void;
  variant: "gray" | "dark" | "orange" | "orange-active";
  wide?: boolean;
}

function CalcButton({ label, onClick, variant, wide = false }: ButtonProps) {
  const base =
    "flex items-center justify-center rounded-full text-white font-light select-none cursor-pointer active:brightness-75 transition-all duration-75";
  const variants = {
    gray: "bg-[#a5a5a5] text-black text-[22px]",
    dark: "bg-[#333333] text-[22px]",
    orange: "bg-[#ff9f0a] text-[28px]",
    "orange-active": "bg-white text-[#ff9f0a] text-[28px]",
  };

  return (
    <button
      className={cn(base, variants[variant], wide ? "col-span-2" : "")}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

interface CalculatorAppProps {
  inShell?: boolean;
}

export function CalculatorApp({ inShell }: CalculatorAppProps) {
  const nav = useWindowNavBehavior({ isDesktop: inShell });
  const [state, setState] = useState<CalcState>(INITIAL_STATE);

  const inputDigit = useCallback((digit: string) => {
    setState((prev) => {
      if (prev.waitingForOperand) {
        return { ...prev, display: digit, waitingForOperand: false, justEvaluated: false };
      }
      if (prev.display === "0" && digit !== ".") {
        return { ...prev, display: digit };
      }
      if (digit === "." && prev.display.includes(".")) return prev;
      const next = prev.display + digit;
      if (next.replace(".", "").replace("-", "").length > 10) return prev;
      return { ...prev, display: next };
    });
  }, []);

  const inputOperator = useCallback((op: Operator) => {
    setState((prev) => {
      const current = parseFloat(prev.display);
      if (prev.operator && !prev.waitingForOperand) {
        const result = calculate(prev.prevValue!, prev.operator, current);
        const formatted = formatDisplay(String(result));
        return {
          display: formatted,
          prevValue: result,
          operator: op,
          waitingForOperand: true,
          justEvaluated: false,
        };
      }
      return {
        ...prev,
        prevValue: current,
        operator: op,
        waitingForOperand: true,
        justEvaluated: false,
      };
    });
  }, []);

  const evaluate = useCallback(() => {
    setState((prev) => {
      if (!prev.operator || prev.prevValue === null) return prev;
      const current = parseFloat(prev.display);
      const result = calculate(prev.prevValue, prev.operator, current);
      const formatted = formatDisplay(String(result));
      return {
        display: formatted,
        prevValue: null,
        operator: null,
        waitingForOperand: false,
        justEvaluated: true,
      };
    });
  }, []);

  const clear = useCallback(() => setState(INITIAL_STATE), []);

  const toggleSign = useCallback(() => {
    setState((prev) => {
      const val = parseFloat(prev.display) * -1;
      return { ...prev, display: formatDisplay(String(val)) };
    });
  }, []);

  const percentage = useCallback(() => {
    setState((prev) => {
      const val = parseFloat(prev.display) / 100;
      return { ...prev, display: formatDisplay(String(val)) };
    });
  }, []);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "0" && e.key <= "9") inputDigit(e.key);
      else if (e.key === ".") inputDigit(".");
      else if (e.key === "+") inputOperator("+");
      else if (e.key === "-") inputOperator("-");
      else if (e.key === "*") inputOperator("×");
      else if (e.key === "/") { e.preventDefault(); inputOperator("÷"); }
      else if (e.key === "Enter" || e.key === "=") evaluate();
      else if (e.key === "Escape") clear();
      else if (e.key === "Backspace") {
        setState((prev) => {
          if (prev.waitingForOperand || prev.display === "0") return prev;
          const next = prev.display.slice(0, -1) || "0";
          return { ...prev, display: next };
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [inputDigit, inputOperator, evaluate, clear]);

  const { display, operator, waitingForOperand } = state;
  const showAC = display === "0" && !state.prevValue;

  return (
    <div
      className="flex flex-col h-full bg-black overflow-hidden"
      style={{ userSelect: "none" }}
    >
      {/* Title bar (drag handle only) */}
      <div
        className="shrink-0 h-7 bg-black flex items-center px-3"
        onMouseDown={nav.onDragStart}
      >
        <div onMouseDown={(e) => e.stopPropagation()}>
          <WindowControls
            inShell={nav.inShell}
            onClose={nav.onClose}
            onMinimize={nav.onMinimize}
            onToggleMaximize={nav.onToggleMaximize}
            isMaximized={nav.isMaximized}
          />
        </div>
      </div>

      {/* Display */}
      <div
        className="shrink-0 flex items-end justify-end px-5 pb-2 bg-black"
        style={{ minHeight: 96 }}
        onMouseDown={nav.onDragStart}
      >
        <span
          className={cn(
            "text-white font-thin leading-none tracking-tight transition-all duration-100",
            getFontSize(display)
          )}
        >
          {display}
        </span>
      </div>

      {/* Buttons */}
      <div
        className="flex-1 grid grid-cols-4 gap-[10px] px-[10px] pb-[10px] bg-black"
        style={{ gridTemplateRows: "repeat(5, 1fr)" }}
      >
        {/* Row 1 */}
        <CalcButton
          label={showAC ? "AC" : "C"}
          variant="gray"
          onClick={clear}
        />
        <CalcButton label="+/-" variant="gray" onClick={toggleSign} />
        <CalcButton label="%" variant="gray" onClick={percentage} />
        <CalcButton
          label="÷"
          variant={operator === "÷" && waitingForOperand ? "orange-active" : "orange"}
          onClick={() => inputOperator("÷")}
        />

        {/* Row 2 */}
        <CalcButton label="7" variant="dark" onClick={() => inputDigit("7")} />
        <CalcButton label="8" variant="dark" onClick={() => inputDigit("8")} />
        <CalcButton label="9" variant="dark" onClick={() => inputDigit("9")} />
        <CalcButton
          label="×"
          variant={operator === "×" && waitingForOperand ? "orange-active" : "orange"}
          onClick={() => inputOperator("×")}
        />

        {/* Row 3 */}
        <CalcButton label="4" variant="dark" onClick={() => inputDigit("4")} />
        <CalcButton label="5" variant="dark" onClick={() => inputDigit("5")} />
        <CalcButton label="6" variant="dark" onClick={() => inputDigit("6")} />
        <CalcButton
          label="−"
          variant={operator === "-" && waitingForOperand ? "orange-active" : "orange"}
          onClick={() => inputOperator("-")}
        />

        {/* Row 4 */}
        <CalcButton label="1" variant="dark" onClick={() => inputDigit("1")} />
        <CalcButton label="2" variant="dark" onClick={() => inputDigit("2")} />
        <CalcButton label="3" variant="dark" onClick={() => inputDigit("3")} />
        <CalcButton
          label="+"
          variant={operator === "+" && waitingForOperand ? "orange-active" : "orange"}
          onClick={() => inputOperator("+")}
        />

        {/* Row 5 */}
        <CalcButton label="0" variant="dark" wide onClick={() => inputDigit("0")} />
        <CalcButton label="." variant="dark" onClick={() => inputDigit(".")} />
        <CalcButton label="=" variant="orange" onClick={evaluate} />
      </div>
    </div>
  );
}
