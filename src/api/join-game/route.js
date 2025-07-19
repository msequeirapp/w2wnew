async function handler({ gameId }) {
  const session = getSession();

  if (!session?.user?.id) {
    return {
      error: "You must be logged in to join a game",
      code: "UNAUTHORIZED",
    };
  }

  if (!gameId) {
    return {
      error: "Game ID is required",
      code: "MISSING_GAME_ID",
    };
  }

  try {
    const [game] = await sql`
      SELECT 
        g.*,
        COUNT(gp.id) as current_participants
      FROM games g
      LEFT JOIN game_participants gp ON g.id = gp.game_id
      WHERE g.id = ${gameId}
      GROUP BY g.id
    `;

    if (!game) {
      return {
        error: "Game not found",
        code: "GAME_NOT_FOUND",
      };
    }

    if (game.status !== "open") {
      return {
        error: "This game is no longer accepting players",
        code: "GAME_NOT_OPEN",
      };
    }

    const gameDate = new Date(game.game_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (gameDate < today) {
      return {
        error: "Cannot join a game that has already passed",
        code: "GAME_EXPIRED",
      };
    }

    if (gameDate.toDateString() === today.toDateString()) {
      const currentTime = new Date();
      const gameTime = new Date(`${game.game_date}T${game.start_time}`);

      if (currentTime >= gameTime) {
        return {
          error: "Cannot join a game that has already started",
          code: "GAME_STARTED",
        };
      }
    }

    const currentParticipants = parseInt(game.current_participants) || 0;
    if (currentParticipants >= game.max_players) {
      return {
        error: "This game is full",
        code: "GAME_FULL",
      };
    }

    const [existingParticipant] = await sql`
      SELECT id FROM game_participants 
      WHERE game_id = ${gameId} AND user_id = ${session.user.id}
    `;

    if (existingParticipant) {
      return {
        error: "You are already participating in this game",
        code: "ALREADY_JOINED",
      };
    }

    const [newParticipant] = await sql`
      INSERT INTO game_participants (game_id, user_id)
      VALUES (${gameId}, ${session.user.id})
      RETURNING id, joined_at
    `;

    const newParticipantCount = currentParticipants + 1;

    if (newParticipantCount >= game.max_players) {
      await sql`
        UPDATE games 
        SET status = 'full', current_players = ${newParticipantCount}
        WHERE id = ${gameId}
      `;
    } else {
      await sql`
        UPDATE games 
        SET current_players = ${newParticipantCount}
        WHERE id = ${gameId}
      `;
    }

    return {
      success: true,
      message: "Successfully joined the game!",
      participant: {
        id: newParticipant.id,
        gameId: gameId,
        userId: session.user.id,
        joinedAt: newParticipant.joined_at,
      },
      gameStatus: newParticipantCount >= game.max_players ? "full" : "open",
      spotsRemaining: game.max_players - newParticipantCount,
    };
  } catch (error) {
    console.error("Error joining game:", error);
    return {
      error: "Failed to join game. Please try again.",
      code: "SERVER_ERROR",
    };
  }
}
export async function POST(request) {
  return handler(await request.json());
}