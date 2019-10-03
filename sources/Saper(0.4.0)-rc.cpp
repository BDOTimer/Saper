///----------------------------------------------------------------------------|
/// Консольный сапер.
/// Version 0.4.0
/// (нужен тест!)
///----------------------------------------------------------------------------:
#include <iostream>
#include <time.h>
#include <stdio.h>
//#include <cstdlib> atoi()
#include <conio.h>
using namespace std;

#define FORi(n)  for (int i = 0; i < n; ++i)
#define FORj(n)  for (int j = 0; j < n; ++j)
#define LOG(v)   Log (#v, v)
#define ENDL(v)  FORi(v)std::cout << "\n"
#define DEBUG(v) Log ("DEBUG: signal!", v); _getch();

const char* mode_win_for_base = "mode 64,48";
const char* mode_win_for_help = "mode 64,36";
struct smystart
{   smystart()
    {   setlocale(0, "");
        system(mode_win_for_base);
        srand((unsigned int)time(NULL));
    }
}mystart;


template<class T1, class T2>
void Log(T1 s, T2 v)
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
    
    //------------------------------------------------------resize(int r, int c)
    void resize(int _r, int _c)
    {   
        if(arr != NULL) 
        {   
            delete_arr   (arr);
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
    {   //info();
        if(arr == NULL)
        {   std::cout << "Нет массива!\n";
            return;
        }
        FORi(row)
        {   FORj(column)
            {   std::cout << arr[i][j];
            }
            std::cout << "\n";
        }
        std::cout << "\n";
    }
    void info()
    {   Log(__FUNCTION__);
        LOG(row);
        LOG(column);
        LOG(arr);
        std::cout << "\n";
    }
    //-------------------------------------------Форматированный вывод на экран:
    void show_format()
    {   
    }
    
    T*  operator[](const int i)const  //noexcept
    {   return arr[i];
    }

    carr<T>& operator=(carr<T>& rhs) //noexcept ///-------------copy assignment:
    {   Log("copy assignment");
        if (this != &rhs)
        {   carr<T> tmp(rhs);
            swap (*this, tmp);
        }
        return *this;
    }

    carr<T>& operator=(carr<T>&& rhs) //noexcept ///------------move assignment:
    {   Log("move assignment");
        swap (*this, rhs);
        return *this;
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
        T** _arr;
        _arr = new T*[r];
        FORi(r)
        {   _arr[i] = new T[c];
        }
        return _arr;
    }
    
    //--------------------------------------------------------------delete_arr()
    void delete_arr(T**& p)
    {   
        FORi(row)
        {   delete[] p[i];
        }
        delete[] p;
        p = NULL;
    }
    
    friend void swap (carr<T>& l, carr<T>& r) //noexcept
    {   using std::swap;
        swap (l.arr ,    r.arr);
        swap (l.row ,    r.row);
        swap (l.column , r.column);
    }
};

typedef  const char* CCR;
void rules          ();
void show_of_mines  ();
void openmines      ();
bool empty  (int, int);
bool is_mine(int, int);
void print_array_2D ();
void clean  (int, int);
bool is_win         ();
bool final      (bool);
void pause       (CCR);
void is_find_mine   ();

template<class T>
T input_user(const char* promt)
{   std::cout << promt << " ";
    T my;
        
    while(!(std::cin>>my) || std::cin.get() != '\n')
    {   std::cout << "Incorrect input!";
        std::cin.clear();
        std::cin.sync();
    }
    return my;
}

///----------------------------------------------------------------------------|
/// Глобалы.
///----------------------------------------------------------------------------:
const int SIZEE = 12; // Рамер поля по дефолту.
const int Bomba =  9; // Чтоб не тратиься на форматировние :)

carr<int>  Playing_field;
carr<bool> openn        ;
int        its_my_lifes ;
int        myrating     ;
int        prize        ;
int        steps        ;


class cConfig
{
public:
    cConfig() : NRow(SIZEE), NCol(SIZEE), BOOM(10)
    {   
    }

    int NRow, NCol;
    int BOOM;

    void init_start()
    {   NRow = SIZEE;
        NCol = SIZEE;
    
        Playing_field.resize(NRow, NCol);
        Playing_field.init_one       (0);

        openn.resize        (NRow, NCol);
        openn.init_one           (false);

        its_my_lifes = 3;
        myrating     = 0;
        prize        = 5;
        steps        = 0;
    }
}config;

int& NRow = config.NRow;
int& NCol = config.NCol;
int& BOOM = config.BOOM; // Количество бомб на поле.


///----------------------------------------------------------------------------|
/// GUI
///----------------------------------------------------------------------------:
class cGui_03
{
    carr<int>&  mi;
    carr<bool>& mb;
    cConfig&   cfg;

public:
    cGui_03(carr<int>& i, carr<bool>& b, cConfig& c) : mi(i), mb(b), cfg(c)
    {
    }
    
    void work()
    {   
        while(true)
        {   system("cls");
            cout << " Настройки\n\n\n"
                 << " 1 - РАЗМЕР ПОЛЯ.\n"
                 << " 2 - Количество БОМБ.\n"
                 << " ...\n"
                 //////////////////////
                 << " 0 - ВЫХОД.\n\n\n";
            char choice = 0;
            choice = input_user<char>(" СДЕЛАЙТЕ ВАШ ВЫБОР: "); ENDL(2);
            if(choice == '0') return;

            switch (choice)
            {   case '1':
                {
                    int   x = 0;
                    int   y = 0;
                    bool  b = true;
                    while(b)
                    {
                        x = input_user<int>(" Введите ШИРИНУ  поля: ");
                        b = (x < 4) || (x > 25);
                     if(b) continue;
                        y = input_user<int>(" Введите ВЫСОТУ поля: ");
                        b = (y < 4) || (y > 35);
                    }
                    mi.resize(x, y);
                    mb.resize(x, y);
                    cfg.NCol = x;
                    cfg.NRow = y;
                }
                break;

                case '2':
                    cfg.BOOM = input_user<int>(" Введите кол-во БОМБ: ");
                break;

                case '0':
                return;

                default:
                    ;
            }
        }
    }
}gui_03(Playing_field, openn, config);

void test_class_cGui_03(carr<int>& i, carr<bool>& b)
{   Log("test_class_cGui_03()");
    cGui_03 gui(i, b, config);
            gui.work();
    pause   ("Тест закончен!\n\n");
}

///--------------------------|
/// Тест всех классов.       |
///--------------------------:
void test_all()
{
    //test_class_cGui_03(Playing_field, openn);
}
///----------------------------------------------------------------------------|
/// main()
///----------------------------------------------------------------------------:
int main()
{   test_all();
    config.init_start();

    char choice;
    while (true)
    {   choice = 0;
        system("cls");
        cout << " САПЕР\n\n\n"
             << " 1 - ИГРАТЬ. \n"
             << " 2 - ПРАВИЛА ИГРЫ << САПЕР. >> \n"
             << " 3 - НАСТРОЙКИ. >> \n"
             << " 0 - ВЫХОД.\n\n\n";

           choice = input_user<char>(" СДЕЛАЙТЕ ВАШ ВЫБОР: "); ENDL(2);
        if(choice == '0') break;

        switch (choice)
        {   
            ///----------------------------------------------------------------|
            /// ИГРАТЬ.     |
            ///----------------------------------------------------------------:
            case '1':
            {   
start:          Playing_field.init_one (0);
                openn.init_one (false);
                
                ///------------------------|
                /// Заполнение минами.     |
                ///------------------------:
                int i,j;

                for (int c = 0; c < BOOM; c++)
                {   do
                    {   i = rand() % NRow;
                        j = rand() % NCol;
                    }
                    while (Playing_field[i][j] != 0);
                    Playing_field[i][j] = Bomba;
                }

//Playing_field[0][0] = Bomba;
//Playing_field[3][3] = Bomba;

                ///------------------------|
                /// Заполнение подсказками.|
                ///------------------------:
                FORi(NRow)
                {   FORj(NCol)
                    {   if (Playing_field[i][j] != Bomba)
                        {   int quantity = 0;
                            if (is_mine(i - 1, j - 1)) quantity++;
                            if (is_mine(i - 1, j    )) quantity++;
                            if (is_mine(i - 1, j + 1)) quantity++;
                            if (is_mine(i, j - 1    )) quantity++;
                            if (is_mine(i, j + 1    )) quantity++;
                            if (is_mine(i + 1, j - 1)) quantity++;
                            if (is_mine(i + 1, j    )) quantity++;
                            if (is_mine(i + 1, j + 1)) quantity++;
                            Playing_field[i][j]  =  quantity;
                        }
                    }
                }
                    
                while (true)
                {   system("cls");
                    cout << "*****************************\n"
                         << "* САПЕР ОШИБАЕТСЯ  ОДИН РАЗ *\n"
                         << "*****************************\n";
                    ENDL(3);
                    print_array_2D();
                    ENDL(1);

                    if(steps == 5)
                    {   steps = 0;
                        prize += 5;
                    }
                    std::cout << "\n\nМои жизни: " << its_my_lifes;
                    std::cout <<   "\nОчки     : " << myrating     << "\n\n";

Log("Я читер!");
Playing_field.show();

                    ///-----------------------------|
                    ///запрашиваем координаты удара.|
                    ///-----------------------------:
                    char input_coordinate[4] = {0};
                    cout << "Введите координаты удара (E7): ";
                    std::cin.clear();
                    std::cin.sync();
                    cin.get(input_coordinate, 4, '\n');

                int i, j;
                // Переводим координаты в цифровой вид ------------------------:
                j = (unsigned int)input_coordinate[0];
                if(j < 66 ) j = j - 65; // буква в промежутке от A до Z [65- 90]
                else        j = j - 97; // буква в промежутке от a до z [97-122]

                i = (input_coordinate[1] - 48);
                if(input_coordinate[2]) i = i *10 +(input_coordinate[2] - 48);
/*
///==================|
/// Отладочный код.  |
///------------------:
Log("\nDEBUGER:\n");
LOG(input_coordinate);
LOG(j);
LOG(i);
pause("дальше\n");
///==================|
*/
                if ((0 > j) && (j > NCol))
                {   std::cout << "Не пытайтесь жульничать!"; LOG(j);
                    _getch();
                    continue;
                }
                //i = atoi(input_coordinate+1);
                if( 0 > i  && i > NRow)
                {   std::cout << "Не пытайтесь жульничать!"; LOG(i);
                    _getch();
                    continue;
                }
                ///--------------
                /// Ход принят! |
                ///-------------:
                steps++;

                    ///--------------------------------------------------------|
                    /// Показываем окрестный кусок поля c пустыми клетками.    |
                    ///--------------------------------------------------------:
                    clean(i, j);

                    if (is_mine(i, j))
                    {   openmines();
                        
                        its_my_lifes--;
                        myrating  -= 5;

                        if(final(true))
                        {   prize = 5;
                            steps = 0;
                            goto start;
                        }

                        if(its_my_lifes == 0)
                        {   break;        /// Проигрыш!
                        }
                    }
                    else
                    {   if (is_win())
                        {   final(false); /// Выигрыш!
                            break;
                        }
                    }

                    is_find_mine();
                } /// loop
            }
            break;

            case '2':
            {   rules();
            }
            break;
                

            case '3':
            ////////////////////////////////////////////////////////////////////
            gui_03.work();
            ////////////////////////////////////////////////////////////////////
            break;

            default:
            {   cout <<
"Ошибка, попробуйте еще раз, нажмите кнопку <Enter>, чтобы повторить попытку" <<
                endl;
                break;
            }
            system("pause");
        }
    }
    return 0;
}

void rules()
{   system(mode_win_for_help);
    cout << "\t\t\t\t\t\t\t\tСАПЕР: ПРАВИЛА И ОБЩИЕ СВЕДЕНИЯ\n\n\n\n";
    cout << "\tНачните с открытия одной ячейки.\n"
         << "\tЧисло в ячейке показывает, сколько мин скрыто вокруг\n"
         << " данной ячейки. Это число поможет понять вам, где находятся\n"
         << " безопасные ячейки, а где находятся бомбы.\n\n";
         
    cout << "\tЕсли рядом с открытой ячейкой есть пустая ячейка,\n"
         << " то она откроется автоматически.\n\n";
    
    cout << "\tЕсли вы открыли ячейку с миной, то игра проиграна.\\nn";
    
    cout << "\tЕсли в ячейке указано число, оно показывает,\n"
         << " сколько мин скрыто в восьми ячейках вокруг данной.\n"
         << " Это число помогает понять, где находятся безопасные ячейки.\n\n";
    
    cout << "\tИгра продолжается до тех пор,\n"
         << " пока вы не откроете все не заминированные ячейки.\n\n\n";
         
    cout << "\tУдачной игры!)\n\n\n\n" << endl;
    
    pause("... продолжить: ENTER");
    system(mode_win_for_base);
}

///----------------------------------------------------------------------------|
/// Вывод минного поля на экран.
///----------------------------------------------------------------------------:
#define PRINT(v) FORi(v)std::cout << " "
#include <iomanip>
void print_array_2D()
{   
    char strLetters[30] = {"ABCDEFGHIJKLMNOPQRSTUVWXYZ"};
    cout << "    ";
    for (int i = 0; i < config.NCol; i++)
    {   cout << " " << strLetters[i];
    }
    cout << endl;

    cout << "     ";
    for (int i = 0; i < config.NCol-1; i++)
    {   cout << "--";
    }
    cout << "-\n";

    FORi(NRow)
    {   cout << std::setw(3) << i << " |";
        FORj(NCol)
        {   
            if (openn[i][j])
            {   switch(Playing_field[i][j])
                {   case Bomba:
                    show_of_mines();
                    break;
                    
                    case 0:
                    cout << "* ";
                    break;
                    
                    default:
                        cout << Playing_field[i][j] << " ";
                }
            }
            else
            {   cout << "& ";
            }
        }
        cout << "\n";
    }
}

void show_of_mines()
{   cout << "* ";
}
///----------------------------------------------------------------|
/// Рекурсивная функция, которая открывает поля в точке попадания. |
///----------------------------------------------------------------:
void clean(int i, int j)
{   if     ((i >= 0) && (i < NRow))
    {   if ((j >= 0) && (j < NCol))
        {   if (!openn[i][j])
            {   openn[i][j] = true;
                if (Playing_field[i][j] == 0)
                {   clean(i - 1, j - 1);
                    clean(i - 1, j    );
                    clean(i - 1, j + 1);
                    clean(i    , j - 1);
                    clean(i    , j + 1);
                    clean(i + 1, j - 1);
                    clean(i + 1, j    );
                    clean(i + 1, j + 1);
                }
            }
        }
    }
}

///----------------------------------------------------------------|
/// Проверяет ячейку на пустоту (true),                            |
/// выход за пределы массива возвращает false                      |
///----------------------------------------------------------------:
bool empty(int i, int j)
{   if     ((i >= 0) && (i<NRow))
    {   if ((j >= 0) && (j<NCol))
        {   if (Playing_field[i][j] == 0) return true;
        }
    }
    return false;
}

///----------------------------------------------------------------|
/// Проверяет ячейку на мину: выход за пределы возвращает false.   |
///----------------------------------------------------------------:
bool is_mine(int i, int j)
{   if    ((i >= 0) && (i<NRow))
    {   if((j >= 0) && (j<NCol))
        {   if(Playing_field[i][j] == Bomba) return true;
        }
    }
    return false;
}

bool is_win()
{   FORi(NRow)
    {   FORj(NCol)
        {   if ((Playing_field[i][j] == Bomba) && !openn[i][j])
                return false;
        }
    }
    return true;
}

// в случае проигрыша эта функция откроет все мины
void openmines()
{   FORi(NRow)
    {   FORj(NCol)
        {   if (Playing_field[i][j] == Bomba) openn[i][j] = true;
        }
    }
}

///----------------------------------------------------------------------------|
/// true - игра продолжается!
///----------------------------------------------------------------------------:
bool final(bool loser)
{   system("cls");

    print_array_2D();
    if (loser)
    {   cout << "\a\n" << "ВЫ ПРОИГРАЛИ...(:\n\n";
        if(its_my_lifes != 0)
        {
            cout << "НО У ВАС ЕЩЁ ЕСТЬ ШАНС!\n\n"
                 << "ОСТАЛОСЬ ЖИЗНЕЙ: " << its_my_lifes << "\n\n";
            return true;
        }
        else
        {   cout << "ВЫ ПОКОЙНИК!(:\n\n"
                 << "ЖИЗНЕЙ БОЛЬШЕ НЕТ!\n";
            system("color 47");
        }
    }
    else
    {   cout << "\a\n" << "УРА! ВЫ ВЫИГРАЛИ!)))\n\n";
        system("color 70");
    }

    pause("продолжить...");
    system("color 07");
    config.init_start();
    return false;
}

///----------------------------------------------------------------------------|
/// Пауза.
///----------------------------------------------------------------------------:
void pause(const char* mess)
{   std::cout << "\nЖмите ENTER " << mess << " ";
    std::cin.clear();
    std::cin.sync();
    _getch();
}

///----------------------------------------------------------------------------|
/// Обезвредить мину.
///----------------------------------------------------------------------------:
bool is_open(int i, int j)
{   if    ((i >= 0) && (i<NRow))
    {   if((j >= 0) && (j<NCol))
        {   if(openn[i][j]) return true;
            else            return false;
        }
    }
    return true;
}

void is_find_mine()
{   FORi(NRow)
    {   FORj(NCol)
        {   if((!openn[i][j]) && (Playing_field[i][j] == Bomba) &&
                    is_open(i - 1, j - 1) &&
                    is_open(i - 1, j    ) &&
                    is_open(i - 1, j + 1) &&
                    is_open(i    , j - 1) &&
                    is_open(i    , j + 1) &&
                    is_open(i + 1, j - 1) &&
                    is_open(i + 1, j    ) &&
                    is_open(i + 1, j + 1) )
            {   /// Ёлы-палы!!! Тут мина!
                openn[i][j] = true;
                myrating += prize;
            }
        }
    }
}

///----------------------------------------------------------------------------|
/// Инициализатор
///----------------------------------------------------------------------------:
void init_game()
{

}
