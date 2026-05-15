import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VisitsChart from "./VisitsChart";

describe("VisitsChart", () => {
  it("renders empty state when data is empty", () => {
    render(<VisitsChart data={[]} />);
    expect(screen.getByText(/sem dados ainda/i)).toBeInTheDocument();
  });

  it("renders legend with Pageviews and Visitantes únicos", () => {
    render(
      <VisitsChart
        data={[
          { date: "2026-05-13", pageviews: 10, uniques: 6 },
          { date: "2026-05-14", pageviews: 14, uniques: 9 },
          { date: "2026-05-15", pageviews: 12, uniques: 7 },
        ]}
      />,
    );
    expect(screen.getByText(/pageviews/i)).toBeInTheDocument();
    expect(screen.getByText(/visitantes únicos/i)).toBeInTheDocument();
  });

  it("shows total pageviews in the header summary", () => {
    render(
      <VisitsChart
        data={[
          { date: "2026-05-13", pageviews: 10, uniques: 6 },
          { date: "2026-05-14", pageviews: 14, uniques: 9 },
          { date: "2026-05-15", pageviews: 12, uniques: 7 },
        ]}
      />,
    );
    expect(screen.getByText("36")).toBeInTheDocument();
  });
});
