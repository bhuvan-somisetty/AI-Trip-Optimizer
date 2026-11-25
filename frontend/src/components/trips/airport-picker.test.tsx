import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocationResponse } from "@/lib/api";

const searchLocations = vi.fn();

vi.mock("@/lib/api", () => ({ searchLocations: (...a: unknown[]) => searchLocations(...a) }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

const { AirportPicker } = await import("./airport-picker");
const { cityName, placeTag } = await import("@/lib/store");

const varanasi: LocationResponse = {
  code: "VNS",
  kind: "airport",
  city: "Varanasi",
  country: "IN",
  country_name: "India",
  airport: "Lal Bahadur Shastri International Airport",
  latitude: 25.4522,
  longitude: 82.8625,
  serves: ["flight"],
};

const ayodhya: LocationResponse = {
  code: "ayodhya",
  kind: "place",
  city: "Ayodhya",
  state: "Uttar Pradesh",
  country: "IN",
  country_name: "India",
  latitude: 26.7991,
  longitude: 82.2052,
  serves: ["flight", "train", "bus"],
  airport_code: "AYJ",
  airport: "Maharshi Valmiki International Airport",
  airport_km: 7,
  station: { name: "Ayodhya Dham Junction", code: "AY", km: 1 },
  bus_station: { name: "Tulshi Ghat Bus terminals", km: 1 },
};

const kedarnath: LocationResponse = {
  ...ayodhya,
  code: "kedarnath",
  city: "Kedarnath",
  state: "Uttarakhand",
  serves: [],
  airport_code: "DED",
  airport_km: 105,
  station: null,
  bus_station: { name: "Sonprayag Parking", km: 14 },
};

function setup(props: { value?: string; exclude?: string; mode?: "flight" | "train" | "bus" | "all" } = {}) {
  const onChange = vi.fn();
  const view = render(<AirportPicker id="to" value={props.value ?? "DEL"} exclude={props.exclude} mode={props.mode} onChange={onChange} />);
  return { onChange, box: screen.getByRole("combobox"), ...view };
}

beforeEach(() => {
  searchLocations.mockReset();
});

describe("AirportPicker", () => {
  it("shows the picked city and lists popular cities before anything is typed", async () => {
    const { box } = setup();
    expect(box).toHaveValue("New Delhi (DEL)");
    await userEvent.click(box);
    expect(screen.getByText("Popular")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Goa \(GOI\)/ })).toBeInTheDocument();
    expect(searchLocations).not.toHaveBeenCalled();
  });

  it("searches airports for Flights and saves the picked code", async () => {
    searchLocations.mockResolvedValue({ locations: [varanasi], source: "" });
    const { box, onChange } = setup({ mode: "flight" });
    await userEvent.type(box, "vara");
    const row = await screen.findByRole("option", { name: /Varanasi \(VNS\)/ });
    expect(row).toHaveTextContent("Lal Bahadur Shastri International Airport, India");
    expect(searchLocations).toHaveBeenLastCalledWith("vara", "flight", 10);
    await userEvent.click(row);
    expect(onChange).toHaveBeenCalledWith("VNS");
    // Remembered, so the trips list, dashboard and itinerary can name it too.
    expect(cityName("VNS")).toBe("Varanasi");
  });

  it("finds a town for Compare all with its airport, railway station and bus station", async () => {
    searchLocations.mockResolvedValue({ locations: [ayodhya], source: "" });
    const { box, onChange } = setup({ mode: "all" });
    await userEvent.type(box, "ayod");
    const row = await screen.findByRole("option", { name: /Ayodhya/ });
    expect(searchLocations).toHaveBeenLastCalledWith("ayod", "all", 10);
    expect(row).toHaveTextContent("Uttar Pradesh, India");
    expect(row).toHaveTextContent("AYJ airport, 7 km");
    expect(row).toHaveTextContent("Ayodhya Dham Junction (AY), 1 km");
    expect(row).toHaveTextContent("Tulshi Ghat Bus terminals, 1 km");
    await userEvent.click(row);
    expect(onChange).toHaveBeenCalledWith("ayodhya");
    expect(cityName("ayodhya")).toBe("Ayodhya");
    expect(placeTag("ayodhya")).toBe("AY"); // its own station's code, never an invented one
  });

  it("says when a picked town has no airport of its own and which one the flights use", async () => {
    searchLocations.mockResolvedValue({ locations: [kedarnath], source: "" });
    const { box, onChange, rerender } = setup({ mode: "all" });
    await userEvent.type(box, "kedar");
    const row = await screen.findByRole("option", { name: /Kedarnath/ });
    expect(row).toHaveTextContent("No airport; nearest DED, 105 km");
    await userEvent.click(row);
    rerender(<AirportPicker id="to" value="kedarnath" mode="all" onChange={onChange} />);
    expect(screen.getByText("No airport: flights use DED, 105 km away.")).toBeInTheDocument();
    expect(placeTag("kedarnath")).toBe("Kedarnath");
  });

  it("picks with the keyboard", async () => {
    searchLocations.mockResolvedValue({ locations: [varanasi], source: "" });
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

  it("says so when the search fails or finds nothing, in the words of the way of travel", async () => {
    searchLocations.mockRejectedValueOnce(new Error("offline"));
    const { box } = setup({ mode: "train" });
    await userEvent.type(box, "x");
    expect(await screen.findByText(/Place search isn't available/)).toBeInTheDocument();

    searchLocations.mockResolvedValue({ locations: [], source: "" });
    await userEvent.type(box, "zq");
    expect(await screen.findByText(/No place with a railway station matches "xzq"/)).toBeInTheDocument();
  });

  it("shows a code it doesn't know yet as the bare code", () => {
    const { box } = setup({ value: "ZZZ" });
    expect(box).toHaveValue("ZZZ");
  });
});
