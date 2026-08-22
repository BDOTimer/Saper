///----------------------------------------------------------------------------|
/// C++26
/// Для Роннико ...
///
/// Проверка пересечения сферы с плоскостью треугольника.
///
/// Полноценный демонстрационный стенд на C++ с визуализацией в консоли
/// и подробными комментариями. Стенд будет показывать каждый этап алгоритма
/// и визуализировать результат.
///----------------------------------------------------------------------------:
#include <iostream>
#include <cmath>
#include <vector>
#include <iomanip>
#include <chrono>
#include <random>

// ======================== Векторная математика ========================
struct Vec3
{   float x, y, z;

    Vec3(float x = 0, float y = 0, float z = 0) : x(x), y(y), z(z) {}

    Vec3 operator+(const Vec3& other) const
    {   return {x + other.x, y + other.y, z + other.z};
    }
    Vec3 operator-(const Vec3& other) const
    {   return {x - other.x, y - other.y, z - other.z};
    }
    Vec3 operator*(float scalar) const
    {   return {x * scalar, y * scalar, z * scalar};
    }
    Vec3 operator/(float scalar) const
    {   return {x / scalar, y / scalar, z / scalar};
    }

    float dot(const Vec3& other) const
    {   return x * other.x + y * other.y + z * other.z;
    }
    Vec3 cross(const Vec3& other) const
    {   return
        {   y * other.z - z * other.y,
            z * other.x - x * other.z,
            x * other.y - y * other.x
        };
    }

    float length() const
    {   return std::sqrt(x*x + y*y + z*z);
    }
    float lengthSq() const
    {   return x*x + y*y + z*z;
    }

    Vec3 normalize() const
    {   float len = length();
        return len > 0 ? *this / len : Vec3(0,0,0);
    }

    void print(const std::string& name = "") const
    {   if (!name.empty()) std::cout << name << " = ";
        std::cout << "(" << x << ", " << y << ", " << z << ")\n";
    }
};

// ======================== Геометрические объекты ========================
struct Triangle
{   Vec3 v0, v1, v2;
    Vec3 normal;
    float d; // расстояние от начала координат до плоскости

    Triangle(const Vec3& a, const Vec3& b, const Vec3& c) : v0(a), v1(b), v2(c)
    {   // Вычисляем нормаль треугольника
        Vec3 edge1 = v1 - v0;
        Vec3 edge2 = v2 - v0;
        normal = edge1.cross(edge2).normalize();
        d = normal.dot(v0);
    }

    void print() const
    {   std::cout << "Треугольник:\n";
        v0.print("  v0");
        v1.print("  v1");
        v2.print("  v2");
        normal.print("  Нормаль");
        std::cout << "  d = " << d << "\n";
    }
};

struct Sphere
{   Vec3 center;
    float radius;

    Sphere(const Vec3& c, float r) : center(c), radius(r) {}

    void print() const
    {   std::cout << "Сфера:\n";
        center.print("  Центр");
        std::cout << "  Радиус = " << radius << "\n";
    }
};

// ======================== Основной алгоритм ========================
class SphereTriangleIntersection
{
private:
    const Triangle& tri;
    const Sphere& sphere;
    bool verbose;

    // Вспомогательные функции
    float distanceToPlane(const Vec3& point) const
    {   return tri.normal.dot(point) - tri.d;
    }

    // Проверка, находится ли точка внутри треугольника (в 2D проекции на плоскость)
    bool pointInTriangle(const Vec3& p) const
    {   // Переходим в 2D систему координат на плоскости треугольника
        // Используем барицентрические координаты
        Vec3 v0 = tri.v0, v1 = tri.v1, v2 = tri.v2;

        // Выбираем две оси для 2D проекции
        Vec3 u = (v1 - v0).normalize();
        Vec3 v = (v2 - v0).normalize();
        Vec3 w = u.cross(v).normalize();
        v = w.cross(u).normalize(); // Ортогонализируем

        // Проецируем точки в 2D
        auto to2D = [&](const Vec3& point) -> std::pair<float, float>
        {   Vec3 local = point - v0;
            return {local.dot(u), local.dot(v)};
        };

        auto [p_u, p_v] = to2D(p);
        auto [v0_u, v0_v] = to2D(v0);
        auto [v1_u, v1_v] = to2D(v1);
        auto [v2_u, v2_v] = to2D(v2);

        // Вычисляем барицентрические координаты
        float denom = (v1_u - v0_u) * (v2_v - v0_v) - (v2_u - v0_u) * (v1_v - v0_v);
        if (std::abs(denom) < 1e-6) return false; // Дегенеративный треугольник

        float a = ((v1_u - p_u) * (v2_v - p_v) - (v2_u - p_u) * (v1_v - p_v)) / denom;
        float b = ((v2_u - p_u) * (v0_v - p_v) - (v0_u - p_u) * (v2_v - p_v)) / denom;
        float c = 1 - a - b;

        // Проверка с допуском для численной стабильности
        const float EPS = 1e-5;
        return (a >= -EPS && b >= -EPS && c >= -EPS) && (a <= 1+EPS && b <= 1+EPS && c <= 1+EPS);
    }

    // Расстояние от точки до отрезка (в 3D)
    float distancePointToSegment(const Vec3& point, const Vec3& a, const Vec3& b) const
    {   Vec3 ab = b - a;
        Vec3 ap = point - a;

        float t = ap.dot(ab) / ab.lengthSq();
        t = std::max(0.0f, std::min(1.0f, t));

        Vec3 closest = a + ab * t;
        return (point - closest).length();
    }

public:
    SphereTriangleIntersection(const Triangle& t, const Sphere& s, bool v = true)
        : tri(t), sphere(s), verbose(v) {}

    bool checkIntersection()
    {   if (verbose)
        {   std::cout << "\n" << std::string(60, '=') << "\n";
            std::cout << "ПРОВЕРКА ПЕРЕСЕЧЕНИЯ СФЕРЫ И ТРЕУГОЛЬНИКА\n";
            std::cout << std::string(60, '=') << "\n";
            tri.print();
            sphere.print();
            std::cout << "\n";
        }

        // ==================== ШАГ 1: Проверка вершин ====================
        if (verbose) std::cout << "ШАГ 1: Проверка вершин треугольника\n";

        std::vector<Vec3> vertices = {tri.v0, tri.v1, tri.v2};
        for (size_t i = 0; i < vertices.size(); i++)
        {   float distSq = (vertices[i] - sphere.center).lengthSq();
            if (verbose)
            {   std::cout << "  Расстояние от вершины v" << i << " до центра: "
                          << std::sqrt(distSq) << " (квадрат: " << distSq << ")\n";
                std::cout << "  Радиус^2 = " << sphere.radius * sphere.radius << "\n";
            }

            if (distSq <= sphere.radius * sphere.radius + 1e-6)
            {   if (verbose)
                {   std::cout << "  ✓ Вершина v" << i << " внутри сферы!\n";
                    std::cout << "  РЕЗУЛЬТАТ: ПЕРЕСЕЧЕНИЕ (ранний выход)\n\n";
                }
                return true;
            }
        }

        if (verbose)
        {   std::cout << "  ✗ Все вершины снаружи сферы\n\n";
        }

        // ==================== ШАГ 2: Проверка плоскости ====================
        if (verbose)
        {   std::cout << "ШАГ 2: Проверка пересечения с плоскостью треугольника\n";
            std::cout << "  Формула плоскости: n·x = d\n";
            tri.normal.print("  n");
            std::cout << "  d = " << tri.d << "\n";
        }

        float distToPlane = distanceToPlane(sphere.center);
        if (verbose)
        {   std::cout << "  Расстояние от центра сферы до плоскости: "
                      << std::abs(distToPlane) << "\n";
            std::cout << "  Радиус сферы: " << sphere.radius << "\n";
        }

        if (std::abs(distToPlane) > sphere.radius)
        {   if (verbose)
            {   std::cout << "  ✗ Расстояние до плоскости > радиуса\n";
                std::cout << "  РЕЗУЛЬТАТ: НЕТ ПЕРЕСЕЧЕНИЯ\n\n";
            }
            return false;
        }

        if (verbose)
        {   std::cout << "  ✓ Плоскость пересекает сферу\n";
            std::cout << "  Радиус круга пересечения: "
                      << std::sqrt(sphere.radius * sphere.radius - distToPlane * distToPlane) << "\n\n";
        }

        // ==================== ШАГ 3: Проекция центра сферы ====================
        if (verbose) std::cout << "ШАГ 3: Проекция центра сферы на плоскость\n";

        Vec3 projCenter = sphere.center - tri.normal * distToPlane;
        if (verbose)
        {   projCenter.print("  Проекция центра");
            std::cout << "  Расстояние от проекции до плоскости: 0\n\n";
        }

        // ==================== ШАГ 4: Проверка попадания проекции в треугольник ====================
        if (verbose) std::cout << "ШАГ 4: Проверка попадания проекции в треугольник\n";

        bool inside = pointInTriangle(projCenter);
        if (verbose)
        {   std::cout << "  Проекция " << (inside ? "ВНУТРИ" : "СНАРУЖИ") << " треугольника\n";
        }

        if (inside)
        {   if (verbose)
            {   std::cout << "  ✓ Проекция внутри треугольника\n";
                std::cout << "  РЕЗУЛЬТАТ: ПЕРЕСЕЧЕНИЕ (проекция внутри)\n\n";
            }
            return true;
        }

        if (verbose) std::cout << "\n";

        // ==================== ШАГ 5: Проверка ребер ====================
        if (verbose) std::cout << "ШАГ 5: Проверка расстояния до ребер треугольника\n";

        float rInt = std::sqrt(sphere.radius * sphere.radius - distToPlane * distToPlane);
        if (verbose)
        {   std::cout << "  Радиус круга пересечения (в плоскости): " << rInt << "\n\n";
        }

        std::vector<std::pair<Vec3, Vec3>> edges =
        {   {tri.v0, tri.v1},
            {tri.v1, tri.v2},
            {tri.v2, tri.v0}
        };

        for (size_t i = 0; i < edges.size(); i++)
        {   float dist = distancePointToSegment(projCenter, edges[i].first, edges[i].second);
            if (verbose)
            {   std::cout << "  Расстояние от проекции до ребра " << i << ": " << dist << "\n";
            }

            if (dist <= rInt + 1e-6)
            {   if (verbose)
                {   std::cout << "  ✓ Расстояние до ребра <= радиуса круга пересечения\n";
                    std::cout << "  РЕЗУЛЬТАТ: ПЕРЕСЕЧЕНИЕ (через ребро)\n\n";
                }
                return true;
            }
        }

        if (verbose)
        {   std::cout << "  ✗ Все ребра дальше радиуса круга пересечения\n";
            std::cout << "  РЕЗУЛЬТАТ: НЕТ ПЕРЕСЕЧЕНИЯ\n\n";
        }
        return false;
    }
};

// ======================== Визуализация ASCII ========================
void visualizeResult(const Triangle& tri, const Sphere& sphere, bool intersects)
{   std::cout << "\n" << std::string(60, '-') << "\n";
    std::cout << "ВИЗУАЛИЗАЦИЯ (вид сверху на плоскость XY)\n";
    std::cout << std::string(60, '-') << "\n";

    // Создаем сетку 21x21 символов
    const int GRID_SIZE = 21;
    const float BOUND = 5.0f;
    char grid[GRID_SIZE][GRID_SIZE];

    // Заполняем сетку
    for (int y = 0; y < GRID_SIZE; y++)
    {   for (int x = 0; x < GRID_SIZE; x++)
        {   float wx = -BOUND + (x / (float)(GRID_SIZE-1)) * 2 * BOUND;
            float wy = -BOUND + (y / (float)(GRID_SIZE-1)) * 2 * BOUND;

            Vec3 point(wx, wy, 0);

            // Проверяем, внутри ли треугольника (игнорируем Z)
            // Используем проекцию на плоскость треугольника
            Triangle tri2D(tri.v0, tri.v1, tri.v2);
            Vec3 projPoint = point - tri2D.normal * tri2D.normal.dot(point);

            bool inTri = false;
            if (std::abs(tri2D.normal.z) > 0.1f)
            {   // Простая проверка для демонстрации
                Vec3 v0 = tri.v0, v1 = tri.v1, v2 = tri.v2;
                // Преобразуем в 2D (используем только x,y для простоты)
                auto pointInTriangle2D = [&](float px, float py, float ax, float ay, float bx, float by, float cx, float cy)
                {   float d1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
                    float d2 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
                    float d3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
                    bool hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
                    bool hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
                    return !(hasNeg && hasPos);
                };

                inTri = pointInTriangle2D(wx, wy, v0.x, v0.y, v1.x, v1.y, v2.x, v2.y);
            }

            float distToCenter = (point - sphere.center).length();
            bool inSphere = distToCenter <= sphere.radius;

            if (inTri && inSphere)
            {   grid[y][x] = 'X'; // Пересечение
            }
            else if (inTri)
            {   grid[y][x] = 'T'; // Треугольник
            }
            else if (inSphere)
            {   grid[y][x] = 'O'; // Сфера
            }
            else
            {   grid[y][x] = '.'; // Пусто
            }
        }
    }

    // Выводим сетку
    std::cout << "  X - пересечение, T - треугольник, O - сфера, . - пусто\n\n";
    for (int y = GRID_SIZE-1; y >= 0; y--)
    {   std::cout << std::setw(2) << y << " ";
        for (int x = 0; x < GRID_SIZE; x++)
        {   std::cout << grid[y][x] << " ";
        }
        std::cout << "\n";
    }
    std::cout << "\n  ";
    for (int x = 0; x < GRID_SIZE; x++)
    {   std::cout << x % 10 << " ";
    }
    std::cout << "\n";

    std::cout << "\nРЕЗУЛЬТАТ: " << (intersects ? "ПЕРЕСЕЧЕНИЕ ЕСТЬ ✓" : "НЕТ ПЕРЕСЕЧЕНИЯ ✗") << "\n";
}

// ======================== Генерация тестовых случаев ========================
std::vector<std::pair<Triangle, Sphere>> generateTestCases()
{   std::vector<std::pair<Triangle, Sphere>> tests;

    // Тест 1: Пересечение (центр проекции внутри)
    tests.push_back(
    {   Triangle(Vec3(-2, -1, 0), Vec3(2, -1, 0), Vec3(0, 2, 0)),
        Sphere(Vec3(0, 0, 0.5), 1.0f)
    });

    // Тест 2: Пересечение через ребро
    tests.push_back(
    {   Triangle(Vec3(-3, -1, 0), Vec3(3, -1, 0), Vec3(0, 2, 0)),
        Sphere(Vec3(2.5, 0.5, 0.5), 1.0f)
    });

    // Тест 3: Нет пересечения (слишком далеко)
    tests.push_back(
    {   Triangle(Vec3(-2, -1, 0), Vec3(2, -1, 0), Vec3(0, 2, 0)),
        Sphere(Vec3(5, 5, 0), 1.0f)
    });

    // Тест 4: Пересечение (вершина внутри)
    tests.push_back(
    {   Triangle(Vec3(-3, -2, 0), Vec3(3, -2, 0), Vec3(0, 3, 0)),
        Sphere(Vec3(2.8, -1.5, 0.3), 0.8f)
    });

    // Тест 5: Нет пересечения (сфера пересекает плоскость, но вне треугольника)
    tests.push_back(
    {   Triangle(Vec3(-2, -1, 0), Vec3(2, -1, 0), Vec3(0, 2, 0)),
        Sphere(Vec3(4, 0, 0.5), 1.0f)
    });

    return tests;
}

// ======================== Производительность ========================
void benchmarkAlgorithm(int iterations = 100000)
{   std::cout << "\n" << std::string(60, '=') << "\n";
    std::cout << "ТЕСТ ПРОИЗВОДИТЕЛЬНОСТИ\n";
    std::cout << std::string(60, '=') << "\n";

    Triangle tri(Vec3(-2, -1, 0), Vec3(2, -1, 0), Vec3(0, 2, 0));
    Sphere sphere(Vec3(0, 0, 0.5), 1.0f);

    auto start = std::chrono::high_resolution_clock::now();

    for (int i = 0; i < iterations; i++)
    {   SphereTriangleIntersection checker(tri, sphere, false);
        checker.checkIntersection();
    }

    auto end = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::microseconds>(end - start);

    std::cout << "Количество итераций: " << iterations << "\n";
    std::cout << "Общее время: " << duration.count() / 1000.0 << " мс\n";
    std::cout << "Среднее время на проверку: " << duration.count() / (double)iterations << " мкс\n";
    std::cout << "Проверок в секунду: " << (int)(iterations / (duration.count() / 1000000.0)) << "\n\n";
}

// ======================== Главная функция ========================
int main()
{

    std::system("chcp 65001");

    std::cout << "============================================================\n";
    std::cout << "  3D АЛГОРИТМ ПЕРЕСЕЧЕНИЯ СФЕРЫ И ТРЕУГОЛЬНИКА\n";
    std::cout << "  ДЕМОНСТРАЦИОННЫЙ СТЕНД\n";
    std::cout << "============================================================\n\n";

    // Генерируем тестовые случаи
    auto testCases = generateTestCases();

    // Запускаем тесты
    for (size_t i = 0; i < testCases.size(); i++)
    {   std::cout << "\n" << std::string(60, '#') << "\n";
        std::cout << "ТЕСТ #" << (i + 1) << "\n";
        std::cout << std::string(60, '#') << "\n";

        const auto& [tri, sphere] = testCases[i];
        SphereTriangleIntersection checker(tri, sphere, true);
        bool result = checker.checkIntersection();

        visualizeResult(tri, sphere, result);

        std::cout << "\nНажмите Enter для продолжения...";
        std::cin.get();
    }

    // Запускаем тест производительности
    benchmarkAlgorithm(100000);

    std::cout << "\nДемонстрация завершена.\n";
    return 0;
}
