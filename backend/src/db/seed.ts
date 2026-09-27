import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "../auth/password.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const email = process.env.SEED_EMAIL ?? "demo@cinevault.local";
const password = process.env.SEED_PASSWORD ?? "cinevault123";
const pool = new Pool({ connectionString });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const existing = await client.query<{ id: string }>("SELECT id FROM users WHERE email=$1", [email]);
  const userId = existing.rows[0]?.id ?? randomUUID();
  const passwordHash = await hashPassword(password);
  await client.query(
    `INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,'ADMIN')
     ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,role='ADMIN'`,
    [userId, email, "Daniel", passwordHash]
  );
  await client.query(
    `INSERT INTO profiles(id,user_id,name,avatar_url) VALUES($1,$2,$3,$4)
     ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,avatar_url=EXCLUDED.avatar_url`,
    ["prof_0912", userId, "Daniel", "DP"]
  );
  const genres = [
    ["g_drama", "Drama", "drama"],
    ["g_suspense", "Suspense", "suspense"],
    ["g_crime", "Crime", "crime"],
    ["g_scifi", "Ficcao cientifica", "ficcao-cientifica"]
  ];
  for (const [id, name, slug] of genres) {
    await client.query(
      `INSERT INTO catalog_genres(id,name,slug) VALUES($1,$2,$3)
       ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,slug=EXCLUDED.slug`,
      [id, name, slug]
    );
  }
  const catalog = [
    ["m_7721", "Ecos do Abismo", "ecos-do-abismo", "Quando o oceano recua sem explicacao, uma cartografa encontra uma cidade que nao deveria existir.", 2026, "16", 128],
    ["m_101", "A Ultima Frequencia", "a-ultima-frequencia", "Uma radialista capta uma transmissao que antecipa acontecimentos na cidade antes que eles ocorram.", 2025, "14", 114],
    ["m_102", "Distrito Rubro", "distrito-rubro", "Uma investigadora atravessa a noite mais longa da capital para revelar uma conspiracao enterrada.", 2026, "16", 121]
  ];
  for (const [id, title, slug, synopsis, year, rating, duration] of catalog) {
    await client.query(
      `INSERT INTO catalog_titles(id,kind,title,slug,synopsis,release_year,maturity_rating,duration_minutes,thumbnail_url,hero_image_url,preview_url,status,published_at)
       VALUES($1,'MOVIE',$2,$3,$4,$5,$6,$7,'/assets/hero-cidade-carmim.png','/assets/hero-cidade-carmim.png','', 'PUBLISHED',now())
       ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,slug=EXCLUDED.slug,synopsis=EXCLUDED.synopsis,release_year=EXCLUDED.release_year,maturity_rating=EXCLUDED.maturity_rating,duration_minutes=EXCLUDED.duration_minutes`,
      [id, title, slug, synopsis, year, rating, duration]
    );
    await client.query("DELETE FROM catalog_title_genres WHERE title_id=$1", [id]);
    const titleGenres = id === "m_7721" ? ["g_drama", "g_suspense"] : id === "m_101" ? ["g_scifi", "g_suspense"] : ["g_crime", "g_suspense"];
    await client.query("INSERT INTO catalog_title_genres(title_id,genre_id) SELECT $1,unnest($2::text[])", [id, titleGenres]);
  }
  await client.query(
    `INSERT INTO catalog_titles(id,kind,title,slug,synopsis,release_year,maturity_rating,duration_minutes,thumbnail_url,hero_image_url,preview_url,status,published_at)
     VALUES('m_201','SERIES','Fronteira Escura','fronteira-escura','Uma equipe cientifica investiga sinais vindos de uma regiao esquecida pelo tempo.',2026,'14',NULL,'/assets/hero-cidade-carmim.png','/assets/hero-cidade-carmim.png','','PUBLISHED',now())
     ON CONFLICT(id) DO UPDATE SET kind='SERIES',title=EXCLUDED.title,slug=EXCLUDED.slug,synopsis=EXCLUDED.synopsis,release_year=EXCLUDED.release_year,maturity_rating=EXCLUDED.maturity_rating,duration_minutes=NULL`
  );
  await client.query("DELETE FROM catalog_title_genres WHERE title_id='m_201'");
  await client.query("INSERT INTO catalog_title_genres(title_id,genre_id) VALUES('m_201','g_drama'),('m_201','g_scifi')");
  await client.query(
    `INSERT INTO catalog_seasons(id,title_id,season_number,title,synopsis) VALUES('s_201_1','m_201',1,'Primeira temporada','A descoberta de um sinal muda o destino da equipe.')
     ON CONFLICT(id) DO UPDATE SET season_number=EXCLUDED.season_number,title=EXCLUDED.title,synopsis=EXCLUDED.synopsis`
  );
  const episodes = [
    ["e_201_1", 1, "O Sinal", "Uma transmissao impossivel leva a equipe ate a fronteira.", 48],
    ["e_201_2", 2, "Zona Morta", "A expedicao atravessa uma regiao que nao aparece nos mapas.", 51]
  ];
  for (const [id, number, title, synopsis, duration] of episodes) {
    await client.query(
      `INSERT INTO catalog_episodes(id,season_id,episode_number,title,synopsis,duration_minutes,thumbnail_url,video_url)
       VALUES($1,'s_201_1',$2,$3,$4,$5,'/assets/hero-cidade-carmim.png','')
       ON CONFLICT(id) DO UPDATE SET episode_number=EXCLUDED.episode_number,title=EXCLUDED.title,synopsis=EXCLUDED.synopsis,duration_minutes=EXCLUDED.duration_minutes`,
      [id, number, title, synopsis, duration]
    );
  }
  await client.query("COMMIT");
  console.log(`demo user ready: ${email}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
