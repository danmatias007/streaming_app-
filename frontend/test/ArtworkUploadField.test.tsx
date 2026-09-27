import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArtworkUploadField } from "../src/ArtworkUploadField";
import { adminUploadArtwork } from "../src/api";

jest.mock("../src/api", () => ({ adminUploadArtwork: jest.fn() }));

describe("ArtworkUploadField", () => {
  it("envia a capa selecionada e devolve sua URL ao formulário", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    jest.mocked(adminUploadArtwork).mockResolvedValue({ url: "/artwork/capa.png" });
    render(<ArtworkUploadField accessToken="token" label="Capa do catálogo" help="Imagem horizontal" value="" onChange={onChange}/>);

    const file = new File([new Uint8Array([137, 80, 78, 71])], "capa.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Selecionar imagem"), file);

    expect(adminUploadArtwork).toHaveBeenCalledWith("token", file);
    expect(onChange).toHaveBeenCalledWith("/artwork/capa.png");
  });
});
