import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedbackWidget } from "./FeedbackWidget";

vi.mock("../lib/api", () => ({ api: { post: vi.fn() } }));
vi.mock("../lib/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../lib/AlertContext", () => ({ useAlert: () => ({ showAlert: vi.fn() }) }));
vi.mock("../lib/FeedbackContext", () => ({
  useFeedback: () => ({ isOpen: false, openFeedbackModal: vi.fn(), closeFeedbackModal: vi.fn() }),
}));

describe("FeedbackWidget", () => {
  it("a bolinha fica pequena, acima da barra inferior e na cor Nuvi", () => {
    render(<FeedbackWidget />);
    const b = screen.getByRole("button", { name: /ajuda e feedback/i });
    expect(b.className).toContain("h-10");
    expect(b.className).toContain("68px");
    expect(b.className).toContain("bg-act");
    expect(b.className).not.toMatch(/green|bottom-28/);
  });
});
