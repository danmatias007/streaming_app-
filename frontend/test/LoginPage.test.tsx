import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginPage } from "../src/LoginPage";
import { I18nProvider } from "../src/I18nContext";
import { requestRegistration } from "../src/api";

const mockSignIn = jest.fn();
jest.mock("../src/AuthContext", () => ({ useAuth: () => ({ signIn: mockSignIn }) }));
jest.mock("../src/api", () => ({ requestRegistration: jest.fn() }));

function renderPage() {
  localStorage.setItem("cinevault_locale", "pt");
  return render(<I18nProvider><LoginPage /></I18nProvider>);
}

describe("LoginPage", () => {
  it("envia as credenciais preenchidas para autenticação", async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue(undefined);
    renderPage();
    const submit = screen.getAllByRole("button", { name: "Entrar" }).at(-1)!;
    await user.click(submit);
    expect(mockSignIn).toHaveBeenCalledWith({ email: "demo@cinevault.local", password: "cinevault123" });
  });

  it("troca para cadastro e remove o campo de senha", async () => {
    const user = userEvent.setup();
    renderPage();
    const registerTab = screen.getByRole("tab", { name: "Criar conta" });
    await user.click(registerTab);
    expect(registerTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Criar conta" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  });

  it("confirma visualmente o envio do link de cadastro", async () => {
    const user = userEvent.setup();
    jest.mocked(requestRegistration).mockResolvedValue({ message: "ok" });
    renderPage();
    await user.click(screen.getByRole("tab", { name: "Criar conta" }));
    await user.type(screen.getByLabelText("Email"), "novo@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar link de cadastro" }));
    expect(await screen.findByRole("heading", { name: "Verifique seu email" })).toBeInTheDocument();
    expect(requestRegistration).toHaveBeenCalledWith("novo@example.com");
  });
});
