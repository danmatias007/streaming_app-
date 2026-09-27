import { render } from "@testing-library/react";
import type { PlaybackAuthorizationResponse } from "@netflix/shared-types";
import { I18nProvider } from "../src/I18nContext";
import { PlaybackPlayer } from "../src/PlaybackPlayer";

const playback: PlaybackAuthorizationResponse = {
  contentId: "movie_1",
  contentType: "MOVIE",
  movieId: "movie_1",
  playbackStatus: "AUTHORIZED",
  manifestUrl: "/stream/movie.mp4",
  drmLicenseServer: "",
  telemetryIntervalMs: 5_000
};

describe("PlaybackPlayer", () => {
  beforeEach(() => {
    jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it("usa a imagem da obra como fundo do player", () => {
    const { container } = render(
      <I18nProvider>
        <PlaybackPlayer playback={playback} title="Filme de teste" artworkUrl="/media/capa-filme.jpg" onClose={jest.fn()}/>
      </I18nProvider>
    );

    expect(container.querySelector(".player-backdrop")).toHaveStyle({
      backgroundImage: "url(/media/capa-filme.jpg)"
    });
  });
});
