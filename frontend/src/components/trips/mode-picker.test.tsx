import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ModePicker, choiceOf, isTravelChoice, modesOf } from "./mode-picker";

describe("ModePicker", () => {
  it("shows the four ways to travel and reports the one picked", async () => {
    const onChange = vi.fn();
    render(<ModePicker value="all" onChange={onChange} />);
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual([
      expect.stringMatching(/^Flights/),
      expect.stringMatching(/^Trains/),
      expect.stringMatching(/^Buses/),
      expect.stringMatching(/^Compare all/),
    ]);
    expect(screen.getByRole("radio", { name: /Compare all/ })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("radio", { name: /Trains/ }));
    expect(onChange).toHaveBeenCalledWith("train");
  });

  it("turns a choice into the trip's modes and back", () => {
    expect(modesOf("train")).toEqual(["train"]);
    expect(modesOf("all")).toEqual(["flight", "train", "bus"]);
    expect(choiceOf(["bus"])).toBe("bus");
    expect(choiceOf(["flight", "train"])).toBe("all");
    expect(choiceOf(undefined)).toBe("all");
    expect(isTravelChoice("flight")).toBe(true);
    expect(isTravelChoice("rocket")).toBe(false);
  });
});
