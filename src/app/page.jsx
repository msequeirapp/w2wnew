"use client";
import React from "react";
import { useState, useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";


function MainComponent() {
  const { data: user, loading: userLoading } = useUser();
  const [searchLocation, setSearchLocation] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [nearbyFields, setNearbyFields] = useState([]);
  const [upcomingGames, setUpcomingGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningGame, setJoiningGame] = useState(null);
  const [error, setError] = useState(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null);
        // Load nearby fields and upcoming games
        const [fieldsResponse, gamesResponse] = await Promise.all([
          fetch("/api/get-soccer-fields", { method: "POST" }),
          fetch("/api/get-upcoming-games", { method: "POST" }),
        ]);

        if (fieldsResponse.ok) {
          const fieldsData = await fieldsResponse.json();
          console.log("Fields data:", fieldsData);
          setNearbyFields(fieldsData.fields || []);
        } else {
          console.error("Fields response not ok:", fieldsResponse.status);
        }

        if (gamesResponse.ok) {
          const gamesData = await gamesResponse.json();
          console.log("Games data:", gamesData);
          setUpcomingGames(gamesData.games || []);
        } else {
          console.error("Games response not ok:", gamesResponse.status);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        setError("Error cargando datos. Por favor recarga la página.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle location search
  const handleLocationSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(
        `/integrations/google-place-autocomplete/autocomplete/json?input=${encodeURIComponent(
          query
        )}&radius=5000`
      );
      const data = await response.json();
      setSearchResults(data.predictions || []);
    } catch (error) {
      console.error("Error searching locations:", error);
    }
  };

  const selectLocation = (place) => {
    setSearchLocation(place.description);
    setSearchResults([]);
    // Filter fields by location
    searchFieldsByLocation(place.description);
  };

  const searchFieldsByLocation = async (location) => {
    try {
      const response = await fetch("/api/get-soccer-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location }),
      });

      if (response.ok) {
        const data = await response.json();
        setNearbyFields(data.fields || []);
      }
    } catch (error) {
      console.error("Error searching fields:", error);
    }
  };

  const handleJoinGame = async (gameId) => {
    if (!user) {
      alert("Debes iniciar sesión para unirte a un partido");
      return;
    }

    setJoiningGame(gameId);
    try {
      const response = await fetch("/api/join-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });

      const data = await response.json();

      if (data.success) {
        alert("¡Te has unido al partido exitosamente!");
        // Refresh games list
        const gamesResponse = await fetch("/api/get-upcoming-games", {
          method: "POST",
        });
        if (gamesResponse.ok) {
          const gamesData = await gamesResponse.json();
          setUpcomingGames(gamesData.games || []);
        }
      } else {
        alert(data.error || "Error al unirse al partido");
      }
    } catch (error) {
      console.error("Error joining game:", error);
      alert("Error al unirse al partido");
    } finally {
      setJoiningGame(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando MejengasCR...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
          >
            Recargar Página
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <i className="fas fa-futbol text-green-600 text-2xl mr-3"></i>
              <h1 className="text-2xl font-bold text-gray-900">MejengasCR</h1>
            </div>

            <nav className="hidden md:flex space-x-8">
              <a
                href="#fields"
                className="text-gray-700 hover:text-green-600 font-medium"
              >
                Canchas
              </a>
              <a
                href="#games"
                className="text-gray-700 hover:text-green-600 font-medium"
              >
                Mejengas
              </a>
              <a
                href="#"
                className="text-gray-700 hover:text-green-600 font-medium"
              >
                Equipos
              </a>
              <a
                href="#"
                className="text-gray-700 hover:text-green-600 font-medium"
              >
                Torneos
              </a>
            </nav>

            <div className="flex items-center space-x-4">
              {userLoading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-20 rounded"></div>
              ) : user ? (
                <div className="flex items-center space-x-3">
                  <span className="text-gray-700">
                    Hola, {user.name || user.email}
                  </span>
                  <a
                    href="/account/logout"
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Salir
                  </a>
                </div>
              ) : (
                <div className="flex space-x-2">
                  <a
                    href="/account/signin"
                    className="text-green-600 hover:text-green-700 font-medium"
                  >
                    Iniciar Sesión
                  </a>
                  <a
                    href="/account/signup"
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Registrarse
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Encuentra tu próxima <span className="text-green-600">mejenga</span>
          </h2>
          <p className="text-xl text-gray-600 mb-12">
            Reserva canchas, únete a partidos y conecta con jugadores en Costa
            Rica
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <div className="flex bg-white rounded-full shadow-lg overflow-hidden">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="¿Dónde quieres jugar?"
                  value={searchLocation}
                  onChange={(e) => {
                    setSearchLocation(e.target.value);
                    handleLocationSearch(e.target.value);
                  }}
                  className="w-full px-6 py-4 text-lg outline-none"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1">
                    {searchResults.slice(0, 5).map((place, index) => (
                      <button
                        key={index}
                        onClick={() => selectLocation(place)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium">
                          {place.structured_formatting.main_text}
                        </div>
                        <div className="text-sm text-gray-500">
                          {place.structured_formatting.secondary_text}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => searchFieldsByLocation(searchLocation)}
                className="bg-green-600 text-white px-8 py-4 hover:bg-green-700 transition-colors"
              >
                <i className="fas fa-search text-lg"></i>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-6">
            <button
              onClick={() =>
                document
                  .getElementById("fields")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer text-left"
            >
              <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-map-marker-alt text-green-600 text-xl"></i>
              </div>
              <h3 className="font-bold text-lg mb-2">Buscar Canchas</h3>
              <p className="text-gray-600">
                Encuentra canchas cerca de ti con precios y disponibilidad
              </p>
            </button>

            <button
              onClick={() =>
                document
                  .getElementById("games")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer text-left"
            >
              <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-users text-blue-600 text-xl"></i>
              </div>
              <h3 className="font-bold text-lg mb-2">Unirse a Mejengas</h3>
              <p className="text-gray-600">
                Encuentra partidos abiertos y únete como jugador individual
              </p>
            </button>

            <button
              onClick={() => {
                if (!user) {
                  alert("Debes iniciar sesión para crear un equipo");
                  return;
                }
                // TODO: Navigate to create team page
                alert("Función de crear equipo próximamente");
              }}
              className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer text-left"
            >
              <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-trophy text-purple-600 text-xl"></i>
              </div>
              <h3 className="font-bold text-lg mb-2">Crear Equipo</h3>
              <p className="text-gray-600">
                Forma tu equipo y participa en torneos locales
              </p>
            </button>

            <button
              onClick={() => {
                if (!user) {
                  alert("Debes iniciar sesión para reservar una cancha");
                  return;
                }
                // TODO: Navigate to field booking page
                alert("Función de reservar cancha próximamente");
              }}
              className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer text-left"
            >
              <div className="bg-orange-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-calendar text-orange-600 text-xl"></i>
              </div>
              <h3 className="font-bold text-lg mb-2">Reservar Cancha</h3>
              <p className="text-gray-600">
                Reserva y paga por canchas de forma segura online
              </p>
            </button>
          </div>
        </div>
      </section>

      {/* Nearby Fields */}
      <section id="fields" className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-gray-900 mb-8">
            Canchas Populares
          </h3>
          {nearbyFields.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-search text-gray-400 text-4xl mb-4"></i>
              <p className="text-gray-500 text-lg">
                No se encontraron canchas. Intenta buscar por ubicación.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {nearbyFields.slice(0, 6).map((field) => (
                <div
                  key={field.id}
                  className="bg-gray-50 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
                >
                  <div className="h-48 bg-gradient-to-r from-green-400 to-blue-500 relative">
                    <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-full">
                      <span className="text-green-600 font-bold">
                        ₡{field.price_per_hour}/hora
                      </span>
                    </div>
                    {field.field_type && (
                      <div className="absolute top-4 left-4 bg-white px-3 py-1 rounded-full">
                        <span className="text-gray-700 text-sm capitalize">
                          {field.field_type}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <h4 className="font-bold text-xl mb-2">{field.name}</h4>
                    <p className="text-gray-600 mb-3">{field.address}</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {field.amenities &&
                        field.amenities.slice(0, 3).map((amenity, index) => (
                          <span
                            key={index}
                            className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-sm"
                          >
                            {amenity}
                          </span>
                        ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex text-yellow-400">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <i key={star} className="fas fa-star text-sm"></i>
                          ))}
                        </div>
                        <span className="text-gray-600 text-sm ml-2">
                          {field.average_rating
                            ? field.average_rating.toFixed(1)
                            : "4.8"}{" "}
                          ({field.review_count || 24} reseñas)
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          if (!user) {
                            alert("Debes iniciar sesión para ver detalles");
                            return;
                          }
                          alert(
                            `Ver detalles de ${field.name} - Función próximamente`
                          );
                        }}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Ver Detalles
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Upcoming Games */}
      <section id="games" className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-gray-900 mb-8">
            Próximas Mejengas
          </h3>
          {upcomingGames.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-futbol text-gray-400 text-4xl mb-4"></i>
              <p className="text-gray-500 text-lg">
                No hay mejengas programadas. ¡Sé el primero en crear una!
              </p>
              <button
                onClick={() => {
                  if (!user) {
                    alert("Debes iniciar sesión para crear un partido");
                    return;
                  }
                  alert("Función de crear partido próximamente");
                }}
                className="mt-4 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
              >
                Crear Partido
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingGames.slice(0, 6).map((game) => (
                <div
                  key={game.id}
                  className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium capitalize">
                      {game.game_type}
                    </span>
                    <span className="text-gray-500 text-sm">
                      {game.current_participants}/{game.max_players} jugadores
                    </span>
                  </div>

                  <h4 className="font-bold text-lg mb-2">{game.title}</h4>
                  {game.description && (
                    <p className="text-gray-600 mb-3">{game.description}</p>
                  )}

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-gray-600">
                      <i className="fas fa-calendar-alt w-4 mr-2"></i>
                      <span>
                        {new Date(game.game_date).toLocaleDateString("es-CR")}
                      </span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <i className="fas fa-clock w-4 mr-2"></i>
                      <span>
                        {game.start_time} - {game.end_time}
                      </span>
                    </div>
                    {game.field_name && (
                      <div className="flex items-center text-gray-600">
                        <i className="fas fa-map-marker-alt w-4 mr-2"></i>
                        <span>{game.field_name}</span>
                      </div>
                    )}
                    {game.price_per_player && (
                      <div className="flex items-center text-gray-600">
                        <i className="fas fa-money-bill w-4 mr-2"></i>
                        <span>₡{game.price_per_player} por jugador</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleJoinGame(game.id)}
                    disabled={joiningGame === game.id || !user}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {joiningGame === game.id
                      ? "Uniéndose..."
                      : !user
                      ? "Inicia sesión para unirte"
                      : "Unirse al Partido"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <i className="fas fa-futbol text-green-500 text-2xl mr-3"></i>
                <h4 className="text-xl font-bold">MejengasCR</h4>
              </div>
              <p className="text-gray-400">
                La plataforma líder para reservar canchas y organizar partidos
                de fútbol en Costa Rica.
              </p>
            </div>

            <div>
              <h5 className="font-bold mb-4">Servicios</h5>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#fields" className="hover:text-white">
                    Reservar Canchas
                  </a>
                </li>
                <li>
                  <a href="#games" className="hover:text-white">
                    Unirse a Mejengas
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Crear Equipos
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Torneos
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold mb-4">Soporte</h5>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white">
                    Centro de Ayuda
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Contacto
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Términos de Uso
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Privacidad
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold mb-4">Síguenos</h5>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white">
                  <i className="fab fa-facebook text-xl"></i>
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <i className="fab fa-instagram text-xl"></i>
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <i className="fab fa-twitter text-xl"></i>
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 MejengasCR. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default MainComponent;
