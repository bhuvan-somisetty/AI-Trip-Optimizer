import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AirportResponse } from "@/lib/api";

const searchAirports = vi.fn();

vi.mock("@/lib/api", () => ({ searchAirports: (...a: unknown[]) => searchAirports(...a) }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

const { AirportPicker } = await import("./airport-picker");
const { cityName } = await import("@/lib/store");

const varanasi: AirportResponse = {
  code: "VNS",
  city: "Varanasi",
  country: "IN",
  country_name: "India",
  airport: "Lal Bahadur Shastri International Airport",
  latitude: 25.4522,
  longitude: 82.8625,
  size: 3,
  timezone: "Asia/Kolkata",
};

function setup(props: { value?: string; exclude?: string } = {}) {
  const onChange = vi.fn();
  render(<AirportPicker id="to" value={props.value ?? "DEL"} exclude={props.exclude} onChange={onChange} />);
  return { onChange, box: screen.getByRole("combobox") };
}

beforeEach(() => {
  searchAirports.mockReset();
});

describe("AirportPicker", () => {
  it("shows the picked city and lists popular cities before anything is typed", async () => {
    const { box } = setup();
    expect(box).toHaveValue("New Delhi (DEL)");
    await userEvent.click(box);
    expect(screen.getByText("Popular")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Goa \(GOI\)/ })).toBeInTheDocument();
    expect(searchAirports).not.toHaveBeenCalled();
  });

  it("searches every airport and saves the picked code", async () => {
    searchAirports.mockResolvedValue({ airports: [varanasi], source: "OurAirports (public domain)" });
    const { box, onChange } = setup();
    await userEvent.type(box, "vara");
    const row = await screen.findByRole("option", { name: /Varanasi \(VNS\)/ });
    expect(row).toHaveTextContent("Lal Bahadur Shastri International Airport, India");
    expect(searchAirports).toHaveBeenLastCalledWith("vara", 10);
    await userEvent.click(row);
    expect(onChange).toHaveBeenCalledWith("VNS");
    // Remembered, so the trips list, dashboard and itinerary can name it too.
    expect(cityName("VNS")).toBe("Varanasi");
  });

  it("picks with the keyboard", async () => {
    searchAirports.mockResolvedValue({ airports: [varanasi], source: "" });
    const { box, onChange } = setup();
    await userEvent.type(box, "vns");
    await screen.findByRole("option", { name: /Varanasi/ });
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("VNS");
  });

  it("leaves out the other end of the trip", async () => {
    const { box } = setup({ exclude: "GOI" });
    await userEvent.click(box);
    expect(screen.queryByRole("option", { name: /Goa \(GOI\)/ })).not.toBeInTheDocument();
  });

  it("says so when the search fails or finds nothing", async () => {
    searchAirports.mockRejectedValueOnce(new Error("offline"));
    const { box } = setup();
    await userEvent.type(box, "x");
    expect(await screen.findByText(/Airport search isn't available/)).toBeInTheDocument();

    searchAirports.mockResolvedValue({ airports: [], source: "" });
    await userEvent.type(box, "zq");
    expect(await screen.findByText(/No airport matches "xzq"/)).toBeInTheDocument();
  });

  it("shows a code it doesn't know yet as the bare code", () => {
    const { box } = setup({ value: "ZZZ" });
    expect(box).toHaveValue("ZZZ");
  });
});
