import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CatalogTitle, PublicationStatus } from "@netflix/shared-types";
import { AdminPage } from "../src/AdminPage";
import { I18nProvider } from "../src/I18nContext";
import * as api from "../src/api";

jest.mock("../src/api", () => ({
  adminListTitles: jest.fn(), adminListGenres: jest.fn(), adminCreateGenre: jest.fn(), adminCreateTitle: jest.fn(), adminUpdateTitle: jest.fn(), adminSetTitleStatus: jest.fn(),
  adminListMediaJobs: jest.fn(), adminUploadMedia: jest.fn(), adminDeleteMediaJob: jest.fn(), adminUploadArtwork: jest.fn(),
  adminListSeasons: jest.fn(), adminCreateSeason: jest.fn(), adminUpdateSeason: jest.fn(), adminCreateEpisode: jest.fn(), adminUpdateEpisode: jest.fn()
}));

const now = "2026-09-06T12:00:00.000Z";
const series: CatalogTitle = { id:"m_series",kind:"SERIES",title:"Fronteira Escura",slug:"fronteira-escura",synopsis:"Uma equipe investiga sinais vindos de outra região.",releaseYear:2026,maturityRating:"14",durationMinutes:null,thumbnailUrl:"/artwork/series.jpg",heroImageUrl:"/artwork/series-hero.jpg",previewUrl:"",mediaUrl:"",genres:[],status:"PUBLISHED",createdAt:now,updatedAt:now,publishedAt:now };
const movie: CatalogTitle = { id:"m_movie",kind:"MOVIE",title:"Ecos do Abismo",slug:"ecos-do-abismo",synopsis:"Uma cartógrafa encontra uma cidade que não deveria existir.",releaseYear:2026,maturityRating:"16",durationMinutes:128,thumbnailUrl:"/artwork/movie.jpg",heroImageUrl:"/artwork/movie-hero.jpg",previewUrl:"",mediaUrl:"",genres:[],status:"DRAFT",createdAt:now,updatedAt:now,publishedAt:null };

describe("AdminPage", () => {
  beforeEach(() => {
    jest.mocked(api.adminListTitles).mockResolvedValue({ items:[series,movie] });
    jest.mocked(api.adminListGenres).mockResolvedValue({ items:[] });
    jest.mocked(api.adminListMediaJobs).mockResolvedValue({ items:[] });
    jest.mocked(api.adminListSeasons).mockResolvedValue({ items:[] });
    jest.mocked(api.adminSetTitleStatus).mockImplementation(async (_token,id,status) => ({ ...(id===series.id?series:movie), status:status as PublicationStatus }));
  });

  it("liga mídia, trailer, temporadas, edição e publicação às respectivas ações", async () => {
    const user = userEvent.setup();
    render(<I18nProvider><AdminPage accessToken="token-admin" onLogout={jest.fn()}/></I18nProvider>);
    const seriesCard = (await screen.findByRole("heading", { name:"Fronteira Escura" })).closest("article")!;
    const movieCard = screen.getByRole("heading", { name:"Ecos do Abismo" }).closest("article")!;

    await user.click(within(seriesCard).getByRole("button", { name:"Trailer" }));
    expect(await screen.findByText("PIPELINE DE MÍDIA")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name:"Fechar" }));

    await user.click(within(seriesCard).getByRole("button", { name:"Temporadas" }));
    expect(await screen.findByText("ESTRUTURA DA SÉRIE")).toBeInTheDocument();
    expect(api.adminListSeasons).toHaveBeenCalledWith("token-admin", series.id);
    await user.click(within(screen.getByText("ESTRUTURA DA SÉRIE").closest(".series-manager")!).getByRole("button", { name:"Fechar" }));

    await user.click(within(movieCard).getByRole("button", { name:"Mídia" }));
    expect(await screen.findByText("PIPELINE DE MÍDIA")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name:"Fechar" }));

    await user.click(within(movieCard).getByRole("button", { name:"Editar" }));
    expect(screen.getByRole("heading", { name:"Editar título" })).toBeInTheDocument();
    await user.click(within(movieCard).getByRole("button", { name:"Publicar" }));
    expect(api.adminSetTitleStatus).toHaveBeenCalledWith("token-admin", movie.id, "PUBLISHED");
    await user.click(within(seriesCard).getByRole("button", { name:"Arquivar" }));
    expect(api.adminSetTitleStatus).toHaveBeenCalledWith("token-admin", series.id, "ARCHIVED");
  });
});
