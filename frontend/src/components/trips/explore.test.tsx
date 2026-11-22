import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExploreResponse } from "@/lib/api";

const getExplore = vi.fn();

vi.mock("@/lib/api", () => ({ getExplore: (...a: unknown[]) => getExplore(...a) }));
vi.mock("@/lib/store", () => ({ useStore: () => ({ session: { token: "tok" } }) }));

const { ExploreTab } = await import("./explore");

const goa = (overrides: Partial<ExploreResponse> = {}): ExploreResponse => ({
  city: "GOI",
  city_name: "Goa",
  attractions: [
    {
      id: "W1",
      name: "Basilica of Bom Jesus",
      category: "Religious site",
      description: "A UNESCO World Heritage Site.",
      image: "https://upload.wikimedia.org/bom-jesus.jpg",
      wikipedia: "https://en.wikipedia.org/wiki/Basilica_of_Bom_Jesus",
      rating: "3h",
      latitude: 15.5,
      longitude: 73.9,
      distance_m: 2300,
      source: "OpenTripMap (OpenStreetMap, Wikidata, Wikipedia)",
      data_label: "Map data",
    },
  ],
  restaurants: [
    { id: "R1", name: "Ritz Classic", category: "Restaurant", description: null, image: null, wikipedia: null, rating: null, latitude: 15.49, longitude: 73.82, distance_m: 800, source: "OpenTripMap", data_label: "Map data" },
  ],
  dishes: [
    {
      name: "Bebinca",
      ai_description: "A layered Goan dessert.",
      image: "https://upload.wikimedia.org/bebinca.jpg",
      wikipedia_text: "Bebinca is a traditional Indo-Portuguese pudding.",
      wikipedia: "https://en.wikipedia.org/wiki/Bebinca",
      data_label: "AI suggestion",
      image_label: "Photo: Wikipedia",
    },
  ],
  notice: null,
  dishes_notice: null,
  source: "OpenTripMap (OpenStreetMap, Wikidata, Wikipedia)",
  fetched_at: "2026-11-21T10:00:00Z",
  cached: true,
  ...overrides,
});

beforeEach(() => {
  getExplore.mockReset();
});

describe("ExploreTab", () => {
  it("says the first load can take up to a minute", () => {
    getExplore.mockReturnValue(new Promise(() => {}));
    render(<ExploreTab tripId="t1" />);
    expect(screen.getByText(/can take up to a minute/)).toBeInTheDocument();
  });

  it("shows places, food and restaurants with their source labels", async () => {
    getExplore.mockResolvedValue(goa());
    render(<ExploreTab tripId="t1" />);
    expect(await screen.findByText("Basilica of Bom Jesus")).toBeInTheDocument();
    expect(getExplore).toHaveBeenCalledWith("tok", "t1");
    expect(screen.getByText("2.3 km from the city centre")).toBeInTheDocument();
    expect(screen.getByText("Photo: Wikimedia Commons")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Read more on Wikipedia/ })[0]).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Basilica_of_Bom_Jesus");
    expect(screen.getByText("Bebinca")).toBeInTheDocument();
    expect(screen.getByText("AI suggestion")).toBeInTheDocument();
    expect(screen.getByText("Photo: Wikipedia")).toBeInTheDocument();
    expect(screen.getByText("Ritz Classic")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "OpenStreetMap" })).toBeInTheDocument();
  });

  it("shows the API's notices instead of empty lists", async () => {
    getExplore.mockResolvedValue(
      goa({ attractions: [], restaurants: [], dishes: [], notice: "Tourist places aren't set up on the server", dishes_notice: "Local dishes need the AI model on the server" })
    );
    render(<ExploreTab tripId="t1" />);
    expect(await screen.findAllByText("Tourist places aren't set up on the server")).toHaveLength(2);
    expect(screen.getByText("Local dishes need the AI model on the server")).toBeInTheDocument();
  });

  it("shows day trips and famous hotels from Wikidata", async () => {
    const around = { description: null, image: null, wikipedia: "https://en.wikipedia.org/wiki/Dudhsagar_Falls", rating: null, latitude: 15.3, longitude: 74.3, source: "Wikidata and Wikipedia", data_label: "Wikidata", fame: 28, wikidata: "http://www.wikidata.org/entity/Q1" };
    getExplore.mockResolvedValue(
      goa({
        day_trips: [{ ...around, id: "wd-Q1", kind: "day_trip", name: "Dudhsagar Falls", category: "Waterfall", distance_m: 52100 }],
        famous_stays: [{ ...around, id: "wd-Q2", kind: "stay", name: "The Taj Exotica Hotel & Resort", category: "Hotel", distance_m: 14800 }],
        around_from: "the city centre",
        around_notice: null,
      })
    );
    render(<ExploreTab tripId="t1" />);
    expect(await screen.findByText("Day trips nearby")).toBeInTheDocument();
    expect(screen.getByText("Dudhsagar Falls")).toBeInTheDocument();
    expect(screen.getByText("52.1 km from the city centre")).toBeInTheDocument();
    expect(screen.getByText("Famous hotels")).toBeInTheDocument();
    expect(screen.getByText("The Taj Exotica Hotel & Resort")).toBeInTheDocument();
  });

  it("explains missing day trips, and hides the sections for an older API", async () => {
    getExplore.mockResolvedValue(goa({ day_trips: [], famous_stays: [], around_notice: "Wikidata couldn't be reached right now" }));
    const { unmount } = render(<ExploreTab tripId="t1" />);
    expect(await screen.findAllByText("Wikidata couldn't be reached right now")).toHaveLength(2);
    unmount();
    getExplore.mockResolvedValue(goa());
    render(<ExploreTab tripId="t2" />);
    await screen.findByText("Basilica of Bom Jesus");
    expect(screen.queryByText("Day trips nearby")).not.toBeInTheDocument();
  });

  it("leaves out fields the API sent as null", async () => {
    getExplore.mockResolvedValue(goa({ attractions: [{ ...goa().attractions[0], description: null, wikipedia: null, distance_m: null, image: null }] }));
    render(<ExploreTab tripId="t1" />);
    await screen.findByText("Basilica of Bom Jesus");
    expect(screen.queryByText(/from the city centre/)).not.toBeInTheDocument();
    expect(screen.getByText("No photo in the map data")).toBeInTheDocument();
  });
});
