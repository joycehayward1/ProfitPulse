import { fireEvent, render, screen } from "@testing-library/react";
import { ProductTour } from "../ProductTour";
import { TOUR_STEPS } from "@/lib/onboarding-tour";

function setup(step = 0) {
  const handlers = {
    onStepChange: jest.fn(),
    onDismiss: jest.fn(),
    onFinish: jest.fn(),
    onNavigate: jest.fn(),
  };
  render(
    <>
      <div data-tour="sample-banner">Example banner</div>
      <ProductTour steps={TOUR_STEPS} step={step} {...handlers} />
    </>
  );
  return handlers;
}

describe("ProductTour", () => {
  it("is a labelled dialog that says which step this is", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: TOUR_STEPS[0].title });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText(`Step 1 of ${TOUR_STEPS.length}`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: TOUR_STEPS[0].title })).toHaveFocus();
  });

  it("moves forward and back", () => {
    const h = setup(2);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(h.onStepChange).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(h.onStepChange).toHaveBeenCalledWith(1);
  });

  it("can be dismissed with Escape, the close button or Skip", () => {
    const h = setup();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close tour" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(h.onDismiss).toHaveBeenCalledTimes(3);
  });

  it("links to the page a step describes and resumes at the next step", () => {
    const dataStep = TOUR_STEPS.findIndex((s) => s.id === "data");
    const h = setup(dataStep);
    fireEvent.click(screen.getByRole("button", { name: "Open Data" }));
    expect(h.onNavigate).toHaveBeenCalledWith("/data", dataStep + 1);
  });

  it("finishes on the last step, or goes straight to the assessment", () => {
    const h = setup(TOUR_STEPS.length - 1);
    fireEvent.click(screen.getByRole("button", { name: /finish tour/i }));
    expect(h.onFinish).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Start my assessment" }));
    expect(h.onNavigate).toHaveBeenCalledWith("/assessment", TOUR_STEPS.length);
  });
});
