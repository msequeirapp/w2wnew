async function handler({
  fieldId,
  title,
  description,
  gameDate,
  startTime,
  endTime,
  maxPlayers = 22,
  pricePerPlayer,
  gameType = "casual",
}) {
  const session = getSession();

  if (!session?.user?.id) {
    return {
      error: "You must be logged in to create a game",
      code: "UNAUTHORIZED",
    };
  }

  if (!fieldId || !title || !gameDate || !startTime || !endTime) {
    return {
      error: "Field, title, date, start time, and end time are required",
      code: "MISSING_REQUIRED_FIELDS",
    };
  }

  try {
    const [field] = await sql`
      SELECT id, name, is_active, owner_id 
      FROM soccer_fields 
      WHERE id = ${fieldId} AND is_active = true
    `;

    if (!field) {
      return {
        error: "Soccer field not found or inactive",
        code: "FIELD_NOT_FOUND",
      };
    }

    const gameDateTime = new Date(`${gameDate}T${startTime}`);
    const endDateTime = new Date(`${gameDate}T${endTime}`);
    const now = new Date();

    if (gameDateTime <= now) {
      return {
        error: "Game date and time must be in the future",
        code: "INVALID_DATE",
      };
    }

    if (endDateTime <= gameDateTime) {
      return {
        error: "End time must be after start time",
        code: "INVALID_TIME_RANGE",
      };
    }

    if (maxPlayers < 2 || maxPlayers > 50) {
      return {
        error: "Max players must be between 2 and 50",
        code: "INVALID_PLAYER_COUNT",
      };
    }

    if (pricePerPlayer && (pricePerPlayer < 0 || pricePerPlayer > 100000)) {
      return {
        error: "Price per player must be between 0 and 100,000",
        code: "INVALID_PRICE",
      };
    }

    const conflictingGames = await sql`
      SELECT id FROM games 
      WHERE field_id = ${fieldId} 
        AND game_date = ${gameDate}
        AND status IN ('open', 'full')
        AND (
          (start_time <= ${startTime} AND end_time > ${startTime}) OR
          (start_time < ${endTime} AND end_time >= ${endTime}) OR
          (start_time >= ${startTime} AND end_time <= ${endTime})
        )
    `;

    if (conflictingGames.length > 0) {
      return {
        error:
          "There is already a game scheduled at this field during this time",
        code: "TIME_CONFLICT",
      };
    }

    const [newGame] = await sql`
      INSERT INTO games (
        field_id, 
        organizer_id, 
        title, 
        description, 
        game_date, 
        start_time, 
        end_time, 
        max_players, 
        price_per_player, 
        game_type,
        current_players,
        status
      )
      VALUES (
        ${fieldId}, 
        ${session.user.id}, 
        ${title}, 
        ${description || null}, 
        ${gameDate}, 
        ${startTime}, 
        ${endTime}, 
        ${maxPlayers}, 
        ${pricePerPlayer || null}, 
        ${gameType},
        0,
        'open'
      )
      RETURNING *
    `;

    await sql`
      INSERT INTO game_participants (game_id, user_id)
      VALUES (${newGame.id}, ${session.user.id})
    `;

    await sql`
      UPDATE games 
      SET current_players = 1
      WHERE id = ${newGame.id}
    `;

    return {
      success: true,
      message: "Game created successfully!",
      game: {
        id: newGame.id,
        fieldId: newGame.field_id,
        organizerId: newGame.organizer_id,
        title: newGame.title,
        description: newGame.description,
        gameDate: newGame.game_date,
        startTime: newGame.start_time,
        endTime: newGame.end_time,
        maxPlayers: newGame.max_players,
        currentPlayers: 1,
        pricePerPlayer: newGame.price_per_player,
        gameType: newGame.game_type,
        status: newGame.status,
        createdAt: newGame.created_at,
      },
    };
  } catch (error) {
    console.error("Error creating game:", error);
    return {
      error: "Failed to create game. Please try again.",
      code: "SERVER_ERROR",
    };
  }
}
export async function POST(request) {
  return handler(await request.json());
}