import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AccessRoute } from "@/lib/api";
import { ReachRoutes } from "./reach-plan";

const routes: AccessRoute[] = [
  {
    mode: "flight",
    title: "Fly to Kadapa (CDP), then bus or cab 24 km to Mydukuru",
    own: false,
    legs: [
      { mode: "flight", from: "Bangalore (BLR)", to: "Kadapa (CDP)" },
      { mode: "road", from: "Kadapa airport", to: "Mydukuru", km: 24, note: "Bus or cab" },
    ],
  },
  {
    mode: "train",
    title: "Train to Kamalapuram, then bus or cab 16 km to Mydukuru",
    own: false,
    legs: [
      { mode: "train", from: "Bangalore Cantonment (BNC)", to: "Kamalapuram (KKM)" },
      { mode: "road", from: "Kamalapuram station", to: "Mydukuru", km: 16, note: "Bus or cab" },
    ],
    stations: [
      { name: "Kamalapuram", code: "KKM", town: "Kamalapuram", km: 16 },
      { name: "Kadapa Junction", code: "HX", town: "Kadapa", km: 29 },
    ],
  },
  { mode: "bus", title: "Direct bus to Mydukuru (APSRTC Bus Station)", own: true, legs: [{ mode: "bus", from: "Bengaluru", to: "APSRTC Bus Station" }] },
];

describe("ReachRoutes", () => {
  it("shows every way there for Compare all, door to door", () => {
    render(<ReachRoutes routes={routes} mode="all" to="Mydukuru" />);
    expect(screen.getByRole("region", { name: "How to get to Mydukuru" })).toBeInTheDocument();
    expect(screen.getByText("Fly to Kadapa (CDP), then bus or cab 24 km to Mydukuru")).toBeInTheDocument();
    expect(screen.getByText("Bus or cab, 24 km")).toBeInTheDocument();
    expect(screen.getByText(/Other stations nearby: Kadapa Junction \(HX\), 29 km/)).toBeInTheDocument();
    expect(screen.getByText("Direct bus to Mydukuru (APSRTC Bus Station)")).toBeInTheDocument();
  });

  it("shows only the chosen way of travel", () => {
    render(<ReachRoutes routes={routes} mode="flight" to="Mydukuru" />);
    expect(screen.getByText("By flight")).toBeInTheDocument();
    expect(screen.queryByText("By train")).not.toBeInTheDocument();
    expect(screen.queryByText("By bus")).not.toBeInTheDocument();
  });

  it("shows nothing when that way of travel has no route", () => {
    const { container } = render(<ReachRoutes routes={routes.slice(0, 1)} mode="train" to="Mydukuru" />);
    expect(container).toBeEmptyDOMElement();
  });
});
