import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers/render";
import { InlineError } from "@/components/ui/InlineError";
import { GraphQLError } from "@/lib/graphql";

describe("InlineError", () => {
  it("renders nothing until something has failed", () => {
    const { container } = renderWithProviders(<InlineError error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the server's own message, which is already localized and specific", () => {
    renderWithProviders(
      <InlineError error={new GraphQLError("You are already following this user.", "CONFLICT")} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "You are already following this user.",
    );
  });

  it("falls back to a generic line for a transport failure", () => {
    // A network error carries nothing worth showing a user.
    renderWithProviders(<InlineError error={new Error("Failed to fetch")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("That didn't work. Please try again.");
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
  });

  it("announces itself, since the button beside it just returns to its idle label", () => {
    renderWithProviders(<InlineError error={new Error("x")} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("takes extra classes for positioning", () => {
    renderWithProviders(<InlineError error={new Error("x")} className="text-center" />);
    expect(screen.getByRole("alert")).toHaveClass("text-center");
  });

  it("uses the Persian fallback in fa", () => {
    renderWithProviders(<InlineError error={new Error("x")} />, { locale: "fa" });
    expect(screen.getByRole("alert")).toHaveTextContent("انجام نشد. لطفاً دوباره تلاش کنید.");
  });
});
