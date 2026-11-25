import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClassFares } from "./class-fares";

describe("ClassFares", () => {
  it("lists the official fare per class, cheapest first, with its source", () => {
    render(<ClassFares fares={{ "3A": 520, SL: 210, "2A": 725, "2S": 130 }} label="Official fare for 294 km" />);
    const classes = screen.getAllByTitle(/./).map((el) => el.textContent);
    expect(classes).toEqual(["2S ₹130", "SL ₹210", "3A ₹520", "2A ₹725"]);
    expect(screen.getByText(/Official fare for 294 km · Indian Railways fare table \(Railway Board CC 24\/2025\)/)).toBeInTheDocument();
    expect(screen.getByText(/for the classes the train has/)).toBeInTheDocument();
  });

  it("says why there is no fare, and shows nothing without a reason", () => {
    const { container, rerender } = render(<ClassFares fares={null} note="This train has its own tariff (catering or dynamic fare): check it on IRCTC" />);
    expect(screen.getByText(/own tariff/)).toBeInTheDocument();
    rerender(<ClassFares fares={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
