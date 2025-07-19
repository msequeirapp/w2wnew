async function handler({
  limit = 20,
  offset = 0,
  location,
  gameType,
  minPrice,
  maxPrice,
  dateFrom,
  dateTo,
}) {
  try {
    let queryString = `
      SELECT 
        g.*,
        sf.name as field_name,
        sf.address as field_address,
        sf.latitude as field_latitude,
        sf.longitude as field_longitude,
        sf.amenities as field_amenities,
        sf.field_type,
        u.name as organizer_name,
        u.email as organizer_email,
        COUNT(gp.id) as current_participants
      FROM games g
      LEFT JOIN soccer_fields sf ON g.field_id = sf.id
      LEFT JOIN auth_users u ON g.organizer_id = u.id
      LEFT JOIN game_participants gp ON g.id = gp.game_id
      WHERE g.status = 'open' 
        AND g.game_date >= CURRENT_DATE
        AND (g.game_date > CURRENT_DATE OR g.start_time > CURRENT_TIME)
    `;

    const values = [];
    let paramCount = 0;

    if (location) {
      paramCount++;
      queryString += ` AND (
        LOWER(sf.name) LIKE LOWER($${paramCount}) 
        OR LOWER(sf.address) LIKE LOWER($${paramCount})
      )`;
      values.push(`%${location}%`);
    }

    if (gameType) {
      paramCount++;
      queryString += ` AND g.game_type = $${paramCount}`;
      values.push(gameType);
    }

    if (minPrice !== undefined && minPrice !== null) {
      paramCount++;
      queryString += ` AND g.price_per_player >= $${paramCount}`;
      values.push(minPrice);
    }

    if (maxPrice !== undefined && maxPrice !== null) {
      paramCount++;
      queryString += ` AND g.price_per_player <= $${paramCount}`;
      values.push(maxPrice);
    }

    if (dateFrom) {
      paramCount++;
      queryString += ` AND g.game_date >= $${paramCount}`;
      values.push(dateFrom);
    }

    if (dateTo) {
      paramCount++;
      queryString += ` AND g.game_date <= $${paramCount}`;
      values.push(dateTo);
    }

    queryString += `
      GROUP BY g.id, sf.id, u.id
      HAVING COUNT(gp.id) < g.max_players
      ORDER BY g.game_date ASC, g.start_time ASC
    `;

    if (limit) {
      paramCount++;
      queryString += ` LIMIT $${paramCount}`;
      values.push(limit);
    }

    if (offset) {
      paramCount++;
      queryString += ` OFFSET $${paramCount}`;
      values.push(offset);
    }

    const games = await sql(queryString, values);

    let countValues = [];
    let countQuery = `
      SELECT COUNT(DISTINCT g.id) as total
      FROM games g
      LEFT JOIN soccer_fields sf ON g.field_id = sf.id
      LEFT JOIN game_participants gp ON g.id = gp.game_id
      WHERE g.status = 'open' 
        AND g.game_date >= CURRENT_DATE
        AND (g.game_date > CURRENT_DATE OR g.start_time > CURRENT_TIME)
    `;

    let countParamCount = 0;

    if (location) {
      countParamCount++;
      countQuery += ` AND (LOWER(sf.name) LIKE LOWER($${countParamCount}) OR LOWER(sf.address) LIKE LOWER($${countParamCount}))`;
      countValues.push(`%${location}%`);
    }

    if (gameType) {
      countParamCount++;
      countQuery += ` AND g.game_type = $${countParamCount}`;
      countValues.push(gameType);
    }

    if (minPrice !== undefined && minPrice !== null) {
      countParamCount++;
      countQuery += ` AND g.price_per_player >= $${countParamCount}`;
      countValues.push(minPrice);
    }

    if (maxPrice !== undefined && maxPrice !== null) {
      countParamCount++;
      countQuery += ` AND g.price_per_player <= $${countParamCount}`;
      countValues.push(maxPrice);
    }

    if (dateFrom) {
      countParamCount++;
      countQuery += ` AND g.game_date >= $${countParamCount}`;
      countValues.push(dateFrom);
    }

    if (dateTo) {
      countParamCount++;
      countQuery += ` AND g.game_date <= $${countParamCount}`;
      countValues.push(dateTo);
    }

    countQuery += `
      GROUP BY g.id
      HAVING COUNT(gp.id) < g.max_players
    `;

    const [{ total }] = await sql(countQuery, countValues);

    return {
      games: games.map((game) => ({
        ...game,
        current_participants: parseInt(game.current_participants) || 0,
        spots_available:
          game.max_players - (parseInt(game.current_participants) || 0),
        price_per_player: game.price_per_player
          ? parseFloat(game.price_per_player)
          : null,
      })),
      total: parseInt(total) || 0,
      limit,
      offset,
    };
  } catch (error) {
    console.error("Error fetching upcoming games:", error);
    return {
      error: "Failed to fetch upcoming games",
      games: [],
      total: 0,
    };
  }
}
export async function POST(request) {
  return handler(await request.json());
}