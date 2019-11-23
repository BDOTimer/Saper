﻿///----------------------------------------------------------------------------|
/// Просто Филя. статус:[ГРАФ-ИНТЕЛЛЕКТ +]
///----------------------------------------------------------------------------:
#include <iostream>
#include <cstdlib>
#include <ctime>

struct smystart
{   const wchar_t* name_window;
    smystart()
    {   setlocale(0, "");
        system("mode 55,55");
        srand((unsigned int)time(NULL));
        name_window = L"Просто Филя.(клиент) - 2019";
    }
}mystart;

int rrand(int range_min, int range_max)
{   return rand() % (range_max - range_min + 1) + range_min;
}

const int ROW = 41; /// Кол-во рядов   поля Простофили.
const int COL = 45; /// Кол-во стобцов поля Простофили.
char field[ROW][COL+1];

void show()
{   for    (int i = 0; i < ROW; ++i)
    {   for(int j = 0; j < COL; ++j)
        {   std::cout << field[i][j];
        }
        field[i][COL] = '\0';
        std::cout   << "\n";
    }
    std::cout << "\n";
}

///----------------------------------------------------------------------------|
#include <fstream>
/// Пишем в файл:-------------------------------------------------------------->
void file_in_generator(const char* namefile)
{   std::cout << "Пишем в файл!" << "\n";
    std::ofstream file(namefile);
    for(size_t i = 0; i < ROW; i++)
    {   file << (char*)&field[i][0] << "\n";
    }
    file << std::endl;
    file.close();
}

void send_result(const char* namefile, char color)
{   std::cout << "Отсылаем цвет на сервер!" << "\n";
    std::ofstream file(namefile);
    file << color << std::endl;
    file.close();
}
     
/// Читаем из файла:----------------------------------------------------------->
bool from_file(const char* namefile)
{   std::cout << "Читаем из файла..." << "\n";
    std::ifstream file(namefile);
    if (!file.is_open())
    {   std::cout << "Ошибка чтения файла!\n";
        return false;
    }
    for(size_t i = 0; i < ROW; i++)
    {   file >> (char*)(&field[i][0]);
    }
    file.close();
    return true;
}

void arr_generator()
{   for    (int i = 0; i < ROW; ++i)
    {   for(int j = 0; j < COL; ++j)
        {   field[i][j] = 48 + rrand(1, 6);
        }
    }
}

///----------------------------------------------------------------------------|
/// Святая святых.
/// Алгоритм поиска цвета color_result.
///----------------------------------------------------------------------------:
struct sSuper_analize_field
{   char color_my;
    char color_enemy;
    char color_res;
    sSuper_analize_field() : color_res(-1)
    {   color_my    = field[0][0];
        color_enemy = field[ROW-1][COL-1];
        color_res   = work();
    }
    struct sdata
    {   sdata() : c(-1), count(0){}
        char c;
        int  count;
        void inc(char _c, int i)
        {   c      = _c;
            count +=  i;
        }
    };
    
    char work()
    {   sdata data[ROW];
    
        for    (int i = 0; i < ROW; ++i)
        {   if(field[i][0] != color_my) break;
            
            for(int j = 0; j < COL; ++j)
            {   if(field[i][j] == color_enemy)
                {   continue;
                }
                else if(field[i][j] != color_my)
                {   if((data[i].c == field[i][j]) || (data[i].c == -1))
                        data[i].inc(field[i][j], 1);
                }
            }
        }
    
        sdata o;
        for(int i = 0; i < ROW; ++i)
        {   if(data[i].count > o.count) o = data[i];
        }
        color_res = o.c;
        return color_res;
    }
    char test()
    {   //char color = field[0][0];
        return color_res;
    }
};

void all_test();
///----------------------------------------------------------------------------|
/// Старт.
///----------------------------------------------------------------------------:
int main()
{   //all_test();

    ///--------------------------------|
    /// Загрузка поля из "filya.in"    |
    ///--------------------------------:
    if(!from_file("filya.in"))
    {   /// Если "filya.in" отсутствует:
        std::cout <<                           "\n" <<
        "|-------------------------------------|\n" <<
        "|  Генерация тестового filya.in.      |\n" <<
        "|-------------------------------------.\n";
        arr_generator();
        file_in_generator("filya.in");
        if(!from_file("filya.in"))
        {   std::cout << "FATALERROR:\n";
            std::cout << "Провайдер заблокировал сеть!\n";
            std::cout << "Программа будет аварийно завершена!\n";
            std::cin.get();
            //engine.pause(". ");
            return 0;
        }
    }
    
    ///--------------------------------|
    /// Вывод на экран "filya.in"      |
    ///--------------------------------:
    //show();
    all_test();
    
    ///--------------------------------|
    /// Запуск алгорима поиска цвета.  |
    ///--------------------------------:
    sSuper_analize_field go;
    char color_result = go.test();
    
    ///--------------------------------|
    /// Отсылает результат на сервер.  |
    ///--------------------------------:
    send_result("filya.out", color_result);
    std::cout << "color_result = " << color_result << "\n";
    
    std::cout <<                                          "\n" <<
    "|----------------------------------------------------|\n" <<
    "|  Программа закончила сеанс связи и ожидает выход...|\n" <<
    "|-------------------------------------------------end.\n\n";
    //engine.pause(". ");
    std::cin.get();
    return 0;
}

///-//////////////////////////////////////////////////////////////////////////-|
///
/// В поисках Святого Грааля ...
/// (Делаем искусственный СВЕРХ-РАЗУМ)
///
///-//////////////////////////////////////////////////////////////////////////-|
struct A_start
{
    /// (Делаем искусственный СВЕРХ-РАЗУМ) // метка для быстрого поиска в коде.
} const _a_;
///----------------------------------------------------------------------------|
/// Супер-Пупер(с)
/// Консольный Псевдо-Графический Движок.
///
///     ИНТЕРФЕЙС:
///         void set_color( WORD text,WORD back, SHORT x, SHORT y, size_t size);
///         void set_color( WORD text);
///         void pause    ( const char*  message);
/// 
///         COORD getPosCursor();
///         void  setPosCursor(COORD xy);
///
///----------------------------------------------------------------------------:
#include <iostream>
#include <Windows.h>
#include <conio.h>
/// TODO
///----------------------------------------------------------------------------|
/// class Engine
///----------------------------------------------------------------------------:
class cConEngine
{
public:
    HANDLE hcon;
    cConEngine()
    {   setlocale(0, "");
        //SetConsoleCP      (1251);
        //SetConsoleOutputCP(1251);
        hcon = GetStdHandle(STD_OUTPUT_HANDLE);
        SetConsoleTitleW(mystart.name_window);
    }
    enum ConsoleColor
    {   Black         = 0,
        Blue          = 1,
        Green         = 2,
        Cyan          = 3,
        Red           = 4,
        Magenta       = 5,
        Brown         = 6,
        LightGray     = 7,
        DarkGray      = 8,
        LightBlue     = 9,
        LightGreen    = 10,
        LightCyan     = 11,
        LightRed      = 12,
        LightMagenta  = 13,
        Yellow        = 14,
        White         = 15
    };
    
    ///---------------------------------------------------------------set_color:
    void set_color( WORD text,
                    WORD background,
                    SHORT x, 
                    SHORT y, 
                    size_t size )
    {   COORD pos = {y, x};
        COORD mem = getPosCursor();
        SetConsoleCursorPosition(hcon, pos);
        mySetColor(text, background);
        int aa = GetConsoleCP();
        SetConsoleCP      (1251);
        SetConsoleOutputCP(1251);
        SHORT n = pos.X + size;
        for(; pos.X < n; ++pos.X)
        {   char a = read_char (pos);
            std::cout << char(a+256);
        }
        mySetColor();
        
        SetConsoleCP(aa);
        SetConsoleOutputCP(aa);
        SetConsoleCursorPosition(hcon, mem);
    }

    void set_color(WORD text)
    {   SetConsoleTextAttribute(hcon, text);
    }
    
    void pause(const char* s)
    {   mySetColor(Yellow);
        std::cout << "\r                                                    \r" 
                  << "Жми ENTER" << s << "  ";
        
        m_pause();
        std::cout << "\r                                                    \r";
        mySetColor();
    }

    COORD getPosCursor()
    {   CONSOLE_SCREEN_BUFFER_INFO infoCon;
        GetConsoleScreenBufferInfo(hcon, &infoCon);
        COORD coord = {infoCon.dwCursorPosition.X, infoCon.dwCursorPosition.Y};
        return coord;
    }

    void setPosCursor(COORD xy)
    {   SetConsoleCursorPosition(hcon, xy);
    }
 
private:
    void anim_1980()
    {   static char a[] = {"+\\|/"};
        static char b[] = {"\b+"};
        static int  i   = 0;
        b[1] = a[i++];
        std::cout   << b;
        if(i == 4) i = 0;
    }

    void m_pause()
    {   std::cin.clear();
        std::cin.sync ();

        char  key  = 0;
        while(key != 13)
        {   if (_kbhit()) key =  _getch();
        
            Sleep(200);
            anim_1980();
        }
    }

    void mySetColor(WORD text = 7, WORD background = 0)
    {   SetConsoleTextAttribute(hcon, (background << 4) | text);
    }
 
    char read_char (COORD& pos)
    {   const int  SIZE = 1;
        char  buff[SIZE] = {0};
        DWORD cbRead = 0;
        ReadConsoleOutputCharacterA (hcon, buff, SIZE, pos, &cbRead);
        return buff[0];
    }
    WORD read_atrib(COORD& pos)
    {   const int sz = 1;
        WORD  buff[1];
        DWORD cbRead = 0;
        ReadConsoleOutputAttribute(hcon, buff, sz, pos, &cbRead);
        return buff[0];
    }
}engine;

#define COLOR           cConEngine::ConsoleColor
#define NCHAR_COLOR(N)  engine.set_color(COLOR(N-48));\
                        std::cout << N
#define DISPLEY         std::cout
#define BANNER(a,b,c)       std::cout <<"\n"<< a <<"\n"<< b <<"\n"<< c <<"\n";

///------------------------------------------------|
/// Чтобы ОТКЛЮЧИТЬ лог закоментируйте нижестроку. |
///------------------------------------------------:
#define DEBUG_LOG_ ///<---x

#ifdef DEBUG_LOG_
    #define BANNER_DEBUG BANNER
    #define ASSERT(v,str) if(v) std::cout << "\nERROR: [line] = " << __LINE__ \
                          << " -> "<< str << "\n\n";
#else
    #define BANNER_DEBUG
    #define ASSERT
#endif

#include <iostream>
#include <string>
#include <cstdlib>
#include <ctime>
#include <iomanip>
#include <conio.h>

#define FORi(v) for(int i = 0; i < v; ++i)
#define FORj(v) for(int j = 0; j < v; ++j)
#define LOG(v) Log(#v, v)
#define ENDL std::cout << "\n"
#define DEBUG(v) std::cout << #v << " = " << v << "\n"

template<class T>
void Log(const char* s, T v)
{   std::cout << s << " = " << v << "\n";
}
template<class T>
void Log(T v)
{   std::cout << v << "\n";
}

///----------------------------------------------------------------------------|
/// Двумерный динамический массив инкапсулированный в структуре.
///----------------------------------------------------------------------------:
template<class T>
class carr
{
public:
    carr(int _r, int _c) : arr(NULL), row(_r), column(_c)
    {   arr = create_arr(row, column);
    }
    
    carr() : arr(NULL), row(0), column(0)
    {   
    }
    
    carr(carr& _arr) : arr(NULL), row(0), column(0)
    {   resize(_arr.row, _arr.column);
        FORi(row)
            FORj(column)
                arr[i][j] = _arr[i][j];
    }
    
    carr(carr&& _arr) : arr(NULL), row(0), column(0)
    {   
    }
    
   ~carr()
    {   delete_arr(arr);
    }
    
    carr<T>& operator=(carr<T>& rhs) //noexcept ///-------------copy assignment:
    {   //Log("copy assignment");
        if (this != &rhs)
        {   carr<T> tmp(rhs);
            swap (*this, tmp);
        }
        return *this;
    }

    carr<T>& operator=(carr<T>&& rhs) //noexcept ///------------move assignment:
    {   //Log("move assignment");
        swap (*this, rhs);
        return *this;
    }
    
    //------------------------------------------------------resize(int r, int c)
    void resize(int _r, int _c)
    {   if(arr != NULL) 
        {   delete_arr   (arr);
        }
        row    = _r;
        column = _c;
        arr = create_arr(row, column);
    }
    
    //-----------------------------------------------------------init_one(T val)
    void init_one(T _val)
    {   if(arr == NULL)
        {   std::cout << "Нет массива!\n";
            return;
        }
        FORi(row)
            FORj(column)
                arr[i][j] = _val;
    }
    
    int row_()
    {   return row;
    }
    int column_()
    {   return column;
    }
    
    //-------------------------------------------------------------------show():
    void show()
    {   if(arr == NULL)
        {   std::cout << "Нет массива!\n";
            return;
        }
        FORi(row)
        {   FORj(column)
            {   std::cout << arr[i][j];
            }
        }
        std::cout << "\n";
    }
    void info()
    {   //Log(__PRETTY_FUNCTION__);
        LOG(row);
        LOG(column);
        LOG(arr);
        std::cout << "\n";
    }
    //-------------------------------------------Форматированный вывод на экран:
    void show_format()
    {   std::cout << "\nrow    =" << std::setw(3) << row    << "\n";
        std::cout <<   "column =" << std::setw(3) << column << "\n";
        
        FORi(row)
        {   FORj(column)
            {   if(arr[i][j] != -77)
                std::cout << std::setw(5)
                          << std::setprecision(4)
                          << std::setfill(' ') << arr[i][j] << " \t";
                else 
                std::cout << std::setw(5)
                          << std::setprecision(4)
                          << std::setfill(' ') << " empty\t";
            }
            std::cout << "\n";
        }
        std::cout << "\n";
    }
    
    T*  operator[](const int i) const  //noexcept
    {   return arr[i];

    }
    
    void init_rand(int border_start, int border_end = 0)
    {   if(arr == NULL)
        {   std::cout << "Нет массива!\n";return;
        }
        if (border_start > border_end) std::swap(border_start, border_end);
        FORi(row)
            FORj(column)
                arr[i][j] = rrand(border_end, border_start);
    }
    
    static int rrand(int range_max, int range_min = 0)
    {   return rand() % (range_max - range_min + 1) + range_min;
    }
    
protected:
    T** arr;
    int row, column;
    
    //--------------------------------------------------------------create_arr()
    T** create_arr(int r, int c)
    {   //LOG(__PRETTY_FUNCTION__);
        T** _arr = new T*[r];
        FORi(r)
        {   _arr[i] = new T[c];
        }
        return _arr;
    }
    
    //--------------------------------------------------------------delete_arr()
    void delete_arr(T**& p)
    {   FORi(row)
        {   delete[] p[i];
        }
        delete[] p;
        p = NULL;
    }
    
    friend void swap (carr<T>& l, carr<T>& r) //noexcept
    {   using std::swap;
        swap (l.arr   , r.arr);
        swap (l.row   , r.row);
        swap (l.column, r.column);
    }
};

///----------------------------------------------------------------------------|
/// test_class_carr()
///----------------------------------------------------------------------------:
template<class T>
carr<T> foo()
{   carr<T> a1(3, 3);
    a1.init_one(50);
    return a1;
}
void test_class_carr()
{   carr<int> a1(3, 3);
    a1.init_rand(-20, 20);
    
    carr<int> a2(a1);
    a2.show_format();
    
    carr<int> a3;
    a3 = a1;
    a3.show_format();
    
    Log("=================");
    carr<int> a4 = foo<int>();
    a4.show_format();
    a4.init_one(78);
    
    carr<int> a5;
    a5 = foo<int>();
    a5.show_format();
    
    _getch();
}

///----------------------------------------------------------------------------|
/// struct cmyStack
///----------------------------------------------------------------------------:
#include <vector> 
#include <set>
#include <iterator>
template<class T>
class cmyStack
{   std::vector<T> vec;
    size_t        _reserve;
 
public:
    cmyStack(size_t _n) : _reserve(20*_n)
    {   vec.reserve(_n);
    }
    
    T top     ()     {   return *(vec.end()-1);}
    void push (T n) 
    {   vec.push_back(n);
        ASSERT( (_reserve < vec.size()), "WARNING: Увеличьте память!")
    }
    void     pop  ()  {   vec.pop_back    ();}
    bool     empty()  {   return vec.empty();}
    unsigned size ()  {   return vec.size ();}
    void     reset()  {   vec.clear       ();}
    
    std::vector<T> get_bin(){return vec;}
    void show()
    {   if(vec.empty())
        {   std::cout << "Стек пустой!\n"; return;
        }
        for(auto it = vec.begin(); it != vec.end(); ++it) 
        {   std::cout << (*it) << "->";
        }
        std::cout << "\b\b  \n\n";
    }
    

    void put_in_order()
    {   std::set<T> a(vec.begin(), vec.end());

        vec.clear();
        for ( auto it = a.begin(); it != a.end(); ++it )
        {   vec.push_back(*it);
        }
    }
};

typedef int crd_t;
struct  cNode;
typedef cNode* pn;

void test_class_cNode();
void testclass_sField();
void testclass_sVoyager();
void Game();
void all_test()//--------------------------------------------------------------|
{   //test_class_cNode();
    //test_class_carr ();
    //testclass_sField();

    //while(true)
        //testclass_sVoyager();

    Game();
}

struct sIndexCell
{   sIndexCell(crd_t r, crd_t c) : row(r), col(c) {}
    crd_t row;
    crd_t col;
};

///----------------------------------------------------------------------------|
/// Квадро-Нейристор.
///----------------------------------------------------------------------------:
struct cNode
{   cNode(sIndexCell _coord) : 
        contact_1(NULL),
        contact_2(NULL),
        contact_3(NULL),
        contact_4(NULL),
        coord    (_coord),
        mark     (EMPTY),
        status   (1)   {}

    sIndexCell coord;
    char       color;

    pn get_node()
    {   switch(status)
        {   case 1:
            status++;
            return contact_1;
            break;
            
            case 2:
            status++;
            return contact_2;
            break;
            
            case 3:
            status++;
            return contact_3;
            break;
            
            case 4:
            status++;
            return contact_4;
            break;
        }
        return pn(-1);
    }
    void reset() { status =  1; }
    void stop () { status = -1; }

    pn contact_1;
    pn contact_2;
    pn contact_3;
    pn contact_4;

    enum eMark
    {   EMPTY  = 0,
        MARK
    };
    eMark mark;

private:
    int status;
};

void test_class_cNode()///-------------------------------------test_class_cNode:
{   sIndexCell you(20, 19);
    cNode node(you);

    FORi(5)
    {   DEBUG(node.get_node());
    }
    engine.pause(". ");
}

///----------------------------------------------------------------------------|
/// Вспомогательный стек для обхода графа.
///----------------------------------------------------------------------------:
class cmyStack_task : public cmyStack<pn>
{
public:
    cmyStack_task() : cmyStack<pn>(ROW * COL) {}

};

///----------------------------------------------------------------------------|
/// Поле.
///----------------------------------------------------------------------------:
struct sField : public carr<pn>
{
    sField() : carr<pn>(ROW, COL)
    {   FORi(row)
        {   FORj(column)
            {   arr[i][j] = new cNode( sIndexCell(i, j) );
                arr[i][j]->color = field[i][j];
            }

            screen_xy.X = -1;
        }
        build();
    }
   ~sField()
    {   FORi(row)
        {   FORj(column)
            {   delete arr[i][j];
            }
        }
    }

    COORD screen_xy;
    void show(int choice = 2)
    {   static COORD temp = {-1, -1};

        if(temp.X == -1)
        {   screen_xy = engine.getPosCursor();
            temp.X    = 0;
        }
        else
        {   temp      = engine.getPosCursor();
            engine.setPosCursor(screen_xy);
        }
        
        switch(choice)
        {
            case 1: show_black(); break;
            case 2: show_mark (); break;
        }

        engine.set_color(7);
        if(screen_xy.X != -1)
            engine.setPosCursor(temp);
    }

    void paint(char mycolor, char newmycolor)
    {   FORi(row)
        {   FORj(column)
            {   if( (arr[i][j]->mark  == cNode::MARK) &&
                    (arr[i][j]->color ==    mycolor))
                {    arr[i][j]->color  = newmycolor;
                }
            }
        }
    }

    void send_to_game()
    {
        FORi(row)
        {   FORj(column)
            {   field[i][j] = arr[i][j]->color;
            }
        }
    }

private:
    void show_mark()
    {   
        FORi(row)
        {   FORj(column)
            {   
                if(arr[i][j]->mark == cNode::MARK)
                {
                    NCHAR_COLOR(arr[i][j]->color);
                }
                else
                {   engine.set_color(7);
                    std::cout << arr[i][j]->color;
                }
                
            }ENDL;
        }ENDL;
    }

    void show_black()
    {   FORi(row)
        {   FORj(column)
            {   NCHAR_COLOR(arr[i][j]->color);
            }ENDL;
        }ENDL;
    }

    void build()
    {   
        /// Заполняем середину-------------------------------:
        for    (int i = 1; i < row    - 1; i++)
        {   for(int j = 1; j < column - 1; j++)
            {   arr[i][j]->contact_1 = arr[i][j+1];
                arr[i][j]->contact_2 = arr[i+1][j];
                arr[i][j]->contact_3 = arr[i][j-1];
                arr[i][j]->contact_4 = arr[i-1][j];
            }
        }

        /// Заполняем крайние ряды---------------------------:
        for    (int i = 0; i < row   ; i += row-1)
        {   for(int j = 0; j < column; j ++)
            {   
                if(j != column-1)
                    arr[i][j]->contact_1 = arr[i][j+1]; /// >
                if(j != 0)
                    arr[i][j]->contact_3 = arr[i][j-1]; /// <

                if(i != ROW-1)
                    arr[i][j]->contact_2 = arr[i+1][j]; /// v
                if(i != 0)
                    arr[i][j]->contact_4 = arr[i-1][j]; /// ^
            }
        }

        /// Заполняем крайние столбцы------------------------:
        for    (int i = 0; i < row   ; i++)
        {   for(int j = 0; j < column; j += column-1)
            {   
                if(j != column-1)
                    arr[i][j]->contact_1 = arr[i][j+1]; /// >
                if(j != 0)
                    arr[i][j]->contact_3 = arr[i][j-1]; /// <

                if(i != ROW-1)
                    arr[i][j]->contact_2 = arr[i+1][j]; /// v
                if(i != 0)
                    arr[i][j]->contact_4 = arr[i-1][j]; /// ^
            }
        }
    }
};
void testclass_sField()
{   sField test;
    test.show();
    engine.pause(", чтобы продлолжить ...");
}

///----------------------------------------------------------------------------|
/// Вояджер.
///----------------------------------------------------------------------------:
class sVoyager
{   
public:
    sField        pole;
    cmyStack_task stack;
    cmyStack_task stack_border;
    cmyStack_task ncolor;

    const crd_t xs;
    const crd_t ys;

    char    mycolor;
    char enemycolor;
    char newmycolor;

    sVoyager(crd_t _y, crd_t _x) : xs(_x), ys(_y)
    {   mycolor = pole[ys][xs]->color;
        if(xs == 0) enemycolor = pole[ys+ROW-1][xs+COL-1]->color;
        else        enemycolor = pole[0       ][0       ]->color;
    }

    void reset()
    {   stack.       reset();
        stack_border.reset();
        ncolor.      reset();
    }

    void show(int n)
    {   pole.show(n);
    }

    struct sStatictics
    {   sStatictics() : start(0), add(0), all(0) {}
        unsigned start;
        unsigned add;
        unsigned all;
    }stat_amount_mycell;

    void go()
    {   
        tour_to_border(mycolor, pole[ys][xs], stack_border);

        //LOG(stack_border.size   ());
        stack_border.put_in_order();
        //LOG(stack_border.size   ());

        int i = 0;
        while(       !stack_border.empty())
        {   pn next = stack_border.top  ();
                      stack_border.pop  ();
            
            tour_intro(next->color, next, ncolor);
            //LOG(++i); LOG(ncolor.size   ());
        }

        //engine.pause   ("...");

        //LOG(ncolor.size   ());
        ncolor.put_in_order();
        //LOG(ncolor.size   ());

        int m[256] = {0};
        while(!ncolor.empty())
        {    m[ncolor.top  ()->color]++;
               ncolor.pop  ();
        }

        char r = 0;
        FORi(64)
        {   if(m[i] > r)
            {   r = m[i];
                newmycolor = i;
            }
            //std::cout << m[i] << " ";
        }

        //LOG(newmycolor);
    }

    char paint()
    {   pole.paint(mycolor, newmycolor);
        pole.send_to_game();

        mycolor    =        newmycolor;
        newmycolor = 0;
        return mycolor;
    }
    
private:
    void tour_to_border(char Color, pn p, cmyStack_task& cargo)
    {   
        pn  next = p;
            stack. push(next);
            next->mark = cNode::MARK;
            stat_amount_mycell.start = 1;

        while(!stack.empty())
        {
            next = stack.top()->get_node();

            if(next == NULL)   //-------------------------------|
            {   continue;      // Контакт уперся в стенку поля. |
            }                  //-------------------------------|

            if(next == pn(-1)) //-------------------------------|
            {   stack.pop();   // Нод полностью проверен.       |
                continue;      //-------------------------------|
            }

            if(next->color == Color)
            {   
                stack.push(next);
                if (next->mark != cNode::MARK)
                {   next->mark  = cNode::MARK;
                    stat_amount_mycell.start++;
                }
                
            }
            else if(next->color != enemycolor)    //--------------------------|
            {   cargo.push(next);                 // Учет внешнего контура.   |
            }                                     //--------------------------|
            
        }
        //LOG(stat_amount_mycell.start);
    }

    int tour_intro(char Color, pn p, cmyStack_task& cargo)
    {   
        pn         next = p;
        stack.push(next);
        
        if( next->mark != cNode::MARK)
        {   next->mark  = cNode::MARK;
            cargo.push(next);
        }

        int count = 0;

        while(!stack.empty())
        {
            next = stack.top()->get_node();

            if(next == NULL)   //-------------------------------|
            {   continue;      // Контакт уперся в стенку поля. |
            }                  //-------------------------------|

            if(next == pn(-1)) //-------------------------------|
            {   stack.pop();   // Нод полностью проверен.       |
                continue;      //-------------------------------|
            }

            if(next->color == Color)
            {   
                stack.push(next);

                if( next->mark != cNode::MARK)
                {   cargo.push(next);
                    next->mark  = cNode::MARK;
                    count++;
                }
            }
        }
        return count;
    }

public:
    void test_mark()
    {
        //FORi(ROW)
        {   //pole[i][1]->mark = cNode::MARK;
        }
    }
};

void testclass_sVoyager()
{   //sVoyager test(0, 0);
    //system("cls");
    COORD xy = {0,0};
    engine.setPosCursor(xy);


    sVoyager test(ROW-1, COL - 1);
    //test.show    (1);
    //engine.pause(", чтобы продлолжить ...");

    //test.pole[0][1]->color = '8';

    test.go();
    test.paint();


    test.show(2);
    engine.pause(", чтобы продлолжить ...");
}

///-//////////////////////////////////////////////////////////////////////////-|
///
/// ИГРА.
///     Правила:
///         1. Два игрока на клеточном поле.
///         2. Каждая ячейка поля закрашена цветом 1 :-: 6
///         3. Положение Игрока-1: верхний левый угол.
///         4. Положение Игрока-2: нижний правый угол.
///         5. Ходы по очереди.
///         6. Игрок выбирает цвет прилегающий к его области.
///         7. Выбраным цветом область игрока перекрашивается.
///         8. Игроку запрещено выбирать цвет области противника.
///         9. Игра заканчивается, за 3 хода размер области не изменится.
///        10. Победитель определяется большим кол-вом закрашеных клеток.
///
///-//////////////////////////////////////////////////////////////////////////-|

///----------------------------------------------------------------------------|
/// Класс игрока.
///----------------------------------------------------------------------------:
class cPlayer
{   sVoyager voyager;
public:
    cPlayer(crd_t _x, crd_t _y) : voyager(_x, _y)
    {   static_count++;
        number_player = static_count;
    }

    void step()
    {

    }

    int get_stat()
    {   return voyager.stat_amount_mycell.start;
    }

private:
           int number_player;
    static int static_count;
};
int cPlayer::static_count = 0;

///----------------------------------------------------------------------------|
/// Класс игры.
///----------------------------------------------------------------------------:
class cGame
{   //cPlayer one;
    //cPlayer two;

public:
    cGame() //: one(0, 0), two(ROW-1, COL - 1)
    {   
    }

    void go()
    {   COORD xy = {0,0};
        int mem = -1;

        while(arbiter())
        {   //one.step();
            //two.step();
            
            engine.setPosCursor(xy);

            sVoyager one(0, 0);
            one.go();
            one.paint();
            

            Sleep(200);
            engine.setPosCursor(xy);
            one.show(2);
            
            //engine.pause(" дальше two ... ");
            

            sVoyager two(ROW-1, COL - 1);
            two.go();
            two.paint();

            Sleep(200);
            engine.setPosCursor(xy);
            two.show(2);
            
            //engine.pause(" дальше one ... ");
            
            if( mem == one.stat_amount_mycell.start)
            {
                system("cls");
std::cout << "Игрок one: " << one.stat_amount_mycell.start << "\n";
std::cout << "Игрок two: " << two.stat_amount_mycell.start << "\n\n";
                break;
            }
                mem  = one.stat_amount_mycell.start;
        }
    }

private:

    bool arbiter()
    {   static int count = 0;
/*
        if(one.get_stat() == 0) count++;
        else                    count = 0;

        if(two.get_stat() == 0) count++;
        else                    count = 0;

        if(count == 2) return true;
*/
        return true;
    }
    
};

void Game()
{
    cGame game;
          game.go();
}

