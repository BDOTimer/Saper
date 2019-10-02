///----------------------------------------------------------------------------|
/// Консольный сапер.
///----------------------------------------------------------------------------:
#include <iostream>
#include <time.h>
#include <stdio.h>
#include <conio.h>
using namespace std;

#define FORi(n)  for (int i = 0; i < n; ++i)
#define FORj(n)  for (int j = 0; j < n; ++j)
#define LOG(v)   Log (#v, v)
#define ENDL(v)  FORi(v)std::cout << "\n"
#define DEBUG(v) Log ("DEBUG: signal!", v); _getch();

const char* mode_win_for_base = "mode 64,40";
const char* mode_win_for_help = "mode 64,40";
struct smystart
{   smystart()
    {   const char* str1 = "mode 54,40";
        
        setlocale(0, "");
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
    {   info();
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
void rules         ();
void show_of_mines ();
void openmines     ();
bool empty (int, int);
bool mine  (int, int);
void print_array_2D();
void clean (int, int);
bool win_or_lose   ();
void final     (bool);
void pause      (CCR);

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

carr<int>  Playing_field;
carr<bool> openn        ;

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
                        b = (x < 4) || (x > 28);
                     if(b) continue;
                        y = input_user<int>(" Введите ВЫСОТУ поля: ");
                        b = (y < 4) || (y > 35);
                    }
                    mi.resize(x, y);
                    mb.resize(x, y);
                    mi.init_one (0);
                    mb.init_one (false);
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
{   config.init_start();

    test_all();

    char choice;
    while (true)
    {   choice = 0;
        system("cls");
        cout << "САПЕР\n\n\n"
             << "1 - ИГРАТЬ. \n"
             << "2 - ПРАВИЛА ИГРЫ << САПЕР. >> \n"
             << "3 - НАСТРОЙКИ. >> \n"
             << "0 - ВЫХОД.\n\n\n";

           choice = input_user<char>("СДЕЛАЙТЕ ВАШ ВЫБОР: "); ENDL(2);
        if(choice == '0') break;

        switch (choice)
        {   
            ///----------------------------------------------------------------|
            /// ИГРАТЬ.     |
            ///----------------------------------------------------------------:
            case '1':
            {   ///------------------------|
                /// Заполнение минами.     |
                ///------------------------:
                int i,j;
                for (int c = 0; c < BOOM; c++)
                {   do
                    {   i = rand() % NRow;
                        j = rand() % NCol;
                    }
                    while (Playing_field[i][j] != 0);

                    Playing_field[i][j] = -1;
                }

                ///------------------------|
                /// Заполнение подсказками.|
                ///------------------------:
                FORi(NRow)
                {   FORj(NCol)
                    {   if (Playing_field[i][j] != -1)
                        {   int quantity = 0;
                            if (mine(i - 1, j - 1)) quantity++;
                            if (mine(i - 1, j)) quantity++;
                            if (mine(i - 1, j + 1)) quantity++;
                            if (mine(i, j - 1)) quantity++;
                            if (mine(i, j + 1)) quantity++;
                            if (mine(i + 1, j - 1)) quantity++;
                            if (mine(i + 1, j)) quantity++;
                            if (mine(i + 1, j + 1)) quantity++;
                            Playing_field[i][j] = quantity;
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

                    ///-----------------------------|
                    ///запрашиваем координаты удара.|
                    ///-----------------------------:
                    char input_coordinate[3] = { '\0' };
                    cout << "Введите координаты удара (E7): ";
                    //cin.clear();
                    //cin.ignore(100, '\n');
                    //cin.get(input_coordinate, 2);
                  cin >> input_coordinate;

    int i, j;
    // Переводим координаты в цифровой вид ------------------------------------:
    if ((input_coordinate[0] >= 65) && (input_coordinate[0] <= 74))
    {   j = input_coordinate[0] - 65; // Буква в промежутке от A до J.
    }
    else if ((input_coordinate[0] >= 97) && (input_coordinate[0] <= 106))
    {   j = input_coordinate[0] - 97; // Буква в промежутке от a до j
    }
    else continue;   // Если введены неверные значения, возврат в начало цикла.
    if ((input_coordinate[1] >= 48) && (input_coordinate[1] <= 57))
    {   i = input_coordinate[1] - 48;
    }
    else continue;
                    // Далее проверяем все восемь окрестных полей на пустые .
                    // клетки показываем некий кусок поля.
                    clean(i, j);
                    if (mine(i, j))
                    {   openmines();
                        final(true);
                        break;
                    }
                    if (win_or_lose())
                    {   final(false);
                        break;
                    }
                }
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
    char strLetters[30] = {"ABCDEFGHFGHIJKLMNOPQRSTUVWXYZ"};
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
                {   case -1:
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
/// Проверяет ячейку на мину ; выход за пределы возвращает false.  |
///----------------------------------------------------------------:
bool mine(int i, int j)
{   if    ((i >= 0) && (i<NRow))
    {   if((j >= 0) && (j<NCol))
        {   if(Playing_field[i][j] == -1) return true;
        }
    }
    return false;
}

bool win_or_lose()
{   FORi(NRow)
    {   FORj(NCol)
        {   if ((Playing_field[i][j] != -1) && !openn[i][j])
                return false;
        }
    }
    return true;
}

// в случае проигрыша эта функция откроет все мины
void openmines()
{   FORi(NRow)
    {   FORj(NCol)
        {   if (Playing_field[i][j] == -1) openn[i][j] = true;
        }
    }
}

void final(bool loser)
{   system("cls");

    print_array_2D();
    if (loser)
    {   cout << "\a\n" << "ВЫ ПРОИГРАЛИ...(:\n\n";
    }
    else
    {   cout << "\a\n" << "ВЫ ВЫИГРАЛИ!)))\n\n";
    }

    system("pause");
    ENDL(3);
}

///----------------------------------------------------------------------------|
/// Пауза.
///----------------------------------------------------------------------------:
void pause(const char* mess)
{   std::cout << "\nЖмите ENTER " << mess << " ";
    std::cin.get();
}
